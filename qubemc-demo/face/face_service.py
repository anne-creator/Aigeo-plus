#!/usr/bin/env python3
"""Local YuNet + SFace enrollment and recognition service.

Photos and embeddings belong in COFLOOR_FACE_HOME, outside the Git checkout.
"""

import argparse
import base64
import json
import os
import re
from binascii import Error as BinasciiError
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import cv2
import numpy as np


HOME = Path(os.environ.get("COFLOOR_FACE_HOME", Path(__file__).resolve().parent))
MODEL_DIR = HOME / "models"
EMBEDDINGS = HOME / "private-data" / "embeddings.json"
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class FaceEngine:
    def __init__(self, threshold=0.45, margin=0.05):
        self.detector = cv2.FaceDetectorYN.create(
            str(MODEL_DIR / "yunet.onnx"), "", (320, 320), 0.75, 0.3, 5000
        )
        self.recognizer = cv2.FaceRecognizerSF.create(str(MODEL_DIR / "sface.onnx"), "")
        self.threshold = threshold
        self.margin = margin
        self.templates = {}
        if EMBEDDINGS.exists():
            self.templates = json.loads(EMBEDDINGS.read_text())

    @staticmethod
    def decode(image_bytes):
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Image exceeds 8 MB limit")
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if image is None or max(image.shape[:2]) > 6000:
            raise ValueError("Invalid or oversized image")
        return image

    def faces(self, image):
        height, width = image.shape[:2]
        scale = min(1.0, 960 / max(height, width))
        smaller = cv2.resize(image, (round(width * scale), round(height * scale))) if scale < 1 else image
        h, w = smaller.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(smaller)
        ordered = [] if faces is None else sorted(faces, key=lambda face: float(face[2] * face[3]), reverse=True)
        return smaller, ordered, scale

    def feature(self, image, face):
        aligned = self.recognizer.alignCrop(image, face)
        vector = self.recognizer.feature(aligned).flatten().astype(np.float32)
        norm = np.linalg.norm(vector)
        if not np.isfinite(norm) or norm == 0:
            raise ValueError("Could not extract face features")
        return vector / norm

    def match(self, vector):
        scores = sorted(
            ((label, max(float(np.dot(vector, np.asarray(sample, dtype=np.float32)))
                         for sample in samples))
             for label, samples in self.templates.items()),
            key=lambda item: item[1], reverse=True,
        )
        if not scores:
            return {"label": "unknown", "score": 0.0, "scores": []}
        best_label, best_score = scores[0]
        next_score = scores[1][1] if len(scores) > 1 else -1.0
        label = best_label if best_score >= self.threshold and best_score - next_score >= self.margin else "unknown"
        return {"label": label, "score": round(best_score, 4),
                "scores": [{"label": name, "score": round(score, 4)} for name, score in scores]}

    def recognize(self, image_bytes):
        image = self.decode(image_bytes)
        smaller, faces, scale = self.faces(image)
        results = []
        for face in faces:
            vector = self.feature(smaller, face)
            x, y, width, height = (int(round(float(value) / scale)) for value in face[:4])
            results.append({"box": [x, y, width, height], **self.match(vector)})
        return {"faces": results, "width": image.shape[1], "height": image.shape[0]}

    def enroll(self, dataset, holdout="right"):
        templates = {}
        skipped = []
        for path in sorted(dataset.iterdir()):
            if path.suffix.lower() not in IMAGE_TYPES or not path.is_file():
                continue
            label, separator, view = path.stem.partition("_")
            if not separator or not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]{0,39}", label):
                skipped.append({"file": path.name, "reason": "expected label_view filename"})
                continue
            if view == holdout:
                continue
            image = self.decode(path.read_bytes())
            smaller, faces, _ = self.faces(image)
            if not faces or (len(faces) > 1 and faces[0][2] * faces[0][3] < 4 * faces[1][2] * faces[1][3]):
                skipped.append({"file": path.name, "reason": "no unambiguous foreground face"})
                continue
            templates.setdefault(label.lower(), []).append(self.feature(smaller, faces[0]).tolist())
        if not templates:
            raise ValueError("No valid enrollment photos")
        EMBEDDINGS.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        tmp = EMBEDDINGS.with_suffix(".tmp")
        tmp.write_text(json.dumps(templates, separators=(",", ":")))
        os.chmod(tmp, 0o600)
        tmp.replace(EMBEDDINGS)
        self.templates = templates
        return {"enrolled": {label: len(samples) for label, samples in templates.items()}, "skipped": skipped}

    def evaluate(self, dataset, holdout="right"):
        results = []
        for path in sorted(dataset.iterdir()):
            if path.suffix.lower() not in IMAGE_TYPES or path.stem.partition("_")[2] != holdout:
                continue
            expected = path.stem.partition("_")[0].lower()
            faces = self.recognize(path.read_bytes())["faces"]
            predicted = faces[0]["label"] if faces else "unknown"
            results.append({"file": path.name, "expected": expected, "predicted": predicted,
                            "score": faces[0]["score"] if faces else None,
                            "scores": faces[0]["scores"] if faces else []})
        return results


def serve(engine, port):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != "/health":
                return self.respond(404, {"error": "Not found"})
            self.respond(200, {"ready": bool(engine.templates),
                               "enrolled": {key: len(value) for key, value in engine.templates.items()}})

        def do_POST(self):
            if self.path != "/recognize":
                return self.respond(404, {"error": "Not found"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 1 or size > MAX_IMAGE_BYTES * 2:
                    return self.respond(413, {"error": "Image request too large"})
                payload = json.loads(self.rfile.read(size))
                encoded = payload["image"].split(",", 1)[-1]
                image_bytes = base64.b64decode(encoded, validate=True)
                self.respond(200, engine.recognize(image_bytes))
            except (ValueError, KeyError, TypeError, BinasciiError, cv2.error) as error:
                self.respond(400, {"error": str(error)})

        def log_message(self, *_args):
            pass

    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Face service ready on 127.0.0.1:{port}", flush=True)
    server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("enroll", "evaluate", "serve"))
    parser.add_argument("--dataset", type=Path)
    parser.add_argument("--holdout", default="right")
    parser.add_argument("--threshold", type=float, default=float(os.environ.get("COFLOOR_FACE_THRESHOLD", "0.45")))
    parser.add_argument("--margin", type=float, default=float(os.environ.get("COFLOOR_FACE_MARGIN", "0.05")))
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    engine = FaceEngine(args.threshold, args.margin)
    if args.command == "serve":
        serve(engine, args.port)
    else:
        if not args.dataset or not args.dataset.is_dir():
            parser.error("--dataset must be an existing directory")
        output = engine.enroll(args.dataset, args.holdout) if args.command == "enroll" else engine.evaluate(args.dataset, args.holdout)
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
