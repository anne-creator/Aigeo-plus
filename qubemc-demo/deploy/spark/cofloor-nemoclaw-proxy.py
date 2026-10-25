#!/usr/bin/python3
import os
from pathlib import Path
root = Path.home() / ".nemoclaw"
os.environ["OLLAMA_PROXY_TOKEN"] = (root / "ollama-proxy-token").read_text().strip()
os.environ["OLLAMA_PROXY_PORT"] = (root / "ollama-proxy-port").read_text().strip()
backend = (root / "ollama-backend").read_text().strip()
if backend not in ("http://localhost:18000", "http://127.0.0.1:18000"):
    raise SystemExit("NemoClaw inference backend must be the local Spark loopback relay")
os.environ["OLLAMA_BACKEND_URL"] = backend
node = os.environ.get("NEMOCLAW_NODE", str(Path.home() / ".nvm/versions/node/v22.23.4/bin/node"))
os.execv(node, [node, "--no-warnings", str(root / "source/scripts/ollama-auth-proxy.mts")])
