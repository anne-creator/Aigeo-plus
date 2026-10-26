# CoFloor face demo

YuNet detects faces and SFace embeds them. Enrollment computes a small set of
reference embeddings on the DGX Spark; it does not modify the pretrained model
weights. The camera/upload page is `/face-demo.html` and the Node server
proxies requests to a Python service bound to `127.0.0.1:8766`.

The image dataset, model files, and generated embeddings stay outside Git in
`/home/dell/cofloor-face`. Keep the directory private. The source repository
ignores image formats and the local face data directories.

The public HTTPS page is
**https://cofloor.qubemc.com/face-demo.html**. Its requests use the existing
Cloudflare tunnel to reach the CoFloor Node app, which forwards `/api/face/*`
to the loopback face service. The Python service must not listen on a public
interface. HTTPS lets the browser request its own camera; a USB camera on the
Spark is unnecessary when the page is opened on a laptop or phone.

## Install on the Spark

```sh
mkdir -p /home/dell/cofloor-face/models /home/dell/cofloor-face/private-data/dataset
python3 -m venv /home/dell/cofloor-face/.venv
/home/dell/cofloor-face/.venv/bin/pip install opencv-python-headless numpy
curl -fL https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx -o /home/dell/cofloor-face/models/yunet.onnx
curl -fL https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx -o /home/dell/cofloor-face/models/sface.onnx
```

Copy `face_service.py` to `/home/dell/cofloor-face/face_service.py`. Put
consented teammate photos in the private dataset directory with names such as
`anne_front.jpg` and `anne_right.jpg`. The part before the first underscore
is the label. The largest detected foreground face is used for enrollment;
images with no clear dominant face are skipped.

```sh
FACE=/home/dell/cofloor-face
$FACE/.venv/bin/python $FACE/face_service.py enroll --dataset $FACE/private-data/dataset
$FACE/.venv/bin/python $FACE/face_service.py evaluate --dataset $FACE/private-data/dataset
$FACE/.venv/bin/python $FACE/face_service.py serve
```

By default, `*_right.jpg` images are held out of enrollment and used for
evaluation. Enrollment writes `private-data/embeddings.json` with mode 0600.
The service loads embeddings at startup; restart it after re-enrolling.

## Keep a laptop copy

Copy `models/`, `private-data/`, and `face_service.py` to a directory outside
the Git checkout. The service uses the directory containing `face_service.py`
by default, so the same embeddings and weights can be evaluated on another
machine. Create a new Python virtual environment there; the Spark's ARM virtual
environment is not portable to an x86 laptop:

```sh
python3 -m venv .venv
.venv/bin/pip install opencv-python-headless numpy
.venv/bin/python face_service.py evaluate --dataset private-data/dataset
```

The photos and embeddings are biometric data. Keep the backup private and do
not place it in the repository.

For a persistent Spark service, copy
`deploy/spark/cofloor-face.service` into
`/home/dell/.config/systemd/user/`, then run
`systemctl --user daemon-reload` and
`systemctl --user enable --now cofloor-face.service`.

The default cosine threshold is 0.45 with a 0.05 gap required between the top
two labels. These are demo settings calibrated against the three available
teammates and should be retested with independent camera frames. A visual match
is not suitable for access control because this demo has no liveness check.

## Recognition success animation

The face page plays the supplied five-second silent Avatar Forge video only after
`/api/face/recognize` recognizes Anne, Max or Selina. Any of the three
starts the same transition, including a trained teammate in a group frame.
Frames with no trained match keep scanning. If several teammates match, the
first trained match supplies the welcome name. A match stops and releases the camera and freezes the exact
recognized canvas frame, including the match box, for one second. The frozen
frame then expands from its exact on-screen position to fill the browser
viewport over 700 ms, blending into the supplied video when playback starts.
The actual recognized name remains visible during the video. When the
five-second video ends, the page automatically returns to the main page (`/`),
replacing the recognition page in browser history. A Return to main page link
also remains available. Late responses from a cancelled scan are ignored.
Reduced motion skips playback after the freeze and returns automatically;
video errors, rejected playback, or a 12-second loading/playback timeout also
return automatically. Camera and photo upload use the same success sequence.
The animated character remains illustrative, not a reconstruction or login grant.

`npm run build` and `npm run dev` stage the video from the repository's
`assets/cofloor-avatar-forge-5s` directory automatically. Deploy from the full
repository layout so that the assets directory remains beside `qubemc-demo`.

The WebM rendition uses the same supplied silent video at 960×540 for browser
compatibility; MP4 remains the fallback. To repeat the UI regression checks,
start the built app on port 5174 and run `node scripts/test_face_animation.cjs`
with Playwright installed (or set `PLAYWRIGHT_MODULE` to its module path).
These checks use controlled face responses; live recognition is verified separately.

Deploy `face-demo.html` and `face-demo.js` together. The versioned script URL
bypasses Cloudflare’s four-hour cache of the previous welcome-card script.
