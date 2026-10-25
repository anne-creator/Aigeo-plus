#!/usr/bin/env python3
"""Generate a WAV file with Qwen TTS."""

import argparse
import io
import json
import sys
import time
import wave
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request
from local_model_http import open_local_model


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text", nargs="?", default="The local Qwen speech system is ready.")
    parser.add_argument("--url", default="http://100.89.121.112:8004/v1/audio/speech")
    parser.add_argument("--voice", default="Ryan", choices=("Ryan", "Aiden", "Vivian", "Serena", "Ono_Anna", "Sohee"))
    parser.add_argument("--output", type=Path, default=Path("qwen-test.wav"))
    args = parser.parse_args()

    body = {
        "model": "tts-1",
        "input": args.text,
        "voice": args.voice,
        "response_format": "wav",
    }
    headers = {"Content-Type": "application/json", "User-Agent": "curl/8.5.0"}
    request = Request(
        args.url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
    )

    started = time.perf_counter()
    try:
        with open_local_model(request, service="tts", timeout=180) as response:
            audio = response.read()
    except HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"Connection failed: {exc.reason}", file=sys.stderr)
        return 1

    try:
        with wave.open(io.BytesIO(audio), "rb") as wav:
            frames = wav.readframes(wav.getnframes())
            sample_rate = wav.getframerate()
            channels = wav.getnchannels()
            sample_width = wav.getsampwidth()
            duration = len(frames) / (channels * sample_width * sample_rate)
    except (EOFError, wave.Error, ZeroDivisionError) as exc:
        print(f"Server returned invalid WAV audio: {exc}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(sample_width)
        wav.setframerate(sample_rate)
        wav.writeframes(frames)
    print(f"Saved {args.output} ({duration:.2f}s, {sample_rate} Hz, {args.output.stat().st_size:,} bytes)")
    print(f"Generation time: {time.perf_counter() - started:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
