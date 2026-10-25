#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf 'Open http://127.0.0.1:8987/ in your browser\n'
python3 -m http.server 8987 --bind 127.0.0.1
