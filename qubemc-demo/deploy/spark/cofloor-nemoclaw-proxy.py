#!/usr/bin/python3
import os
from pathlib import Path
root = Path.home() / ".nemoclaw"
os.environ["OLLAMA_PROXY_TOKEN"] = (root / "ollama-proxy-token").read_text().strip()
os.environ["OLLAMA_PROXY_PORT"] = (root / "ollama-proxy-port").read_text().strip()
os.environ["OLLAMA_BACKEND_URL"] = (root / "ollama-backend").read_text().strip()
node = os.environ.get("NEMOCLAW_NODE", str(Path.home() / ".nvm/versions/node/v22.23.4/bin/node"))
os.execv(node, [node, "--no-warnings", str(root / "source/scripts/ollama-auth-proxy.mts")])
