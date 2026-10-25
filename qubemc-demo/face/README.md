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
