@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8987/ in your browser
py -3 -m http.server 8987 --bind 127.0.0.1
