# Spark runtime helpers

These helpers capture the inference-proxy repair and Discord setup tested on the Spark with NemoClaw 0.0.137, OpenClaw 2026.9.2, and Node 22.23.4. They configure the existing `cofloor` sandbox. They do not install NemoClaw or change the dashboard workflow.

## Persistent inference proxies

The local vLLM server listens on the Spark's Tailscale address at port 8000. `cofloor-vllm-proxy.py` forwards loopback port 18000 to that server. `COFLOOR_VLLM_HOST` and `COFLOOR_VLLM_PORT` can override the upstream in the service environment.

`cofloor-nemoclaw-proxy.py` runs NVIDIA's installed authenticated proxy using the existing token, backend address, and port under `~/.nemoclaw`. It reads credentials without printing them. This proxy is needed between OpenShell and the loopback endpoint; losing it causes HTTP 503 through `inference.local` even while vLLM remains healthy. The default Node path matches the tested installation; set `NEMOCLAW_NODE` in a systemd drop-in if it differs.

From this directory on the Spark, install the helpers and units:

```bash
install -d "$HOME/.local/lib/cofloor" "$HOME/.config/systemd/user"
install -m 700 cofloor-vllm-proxy.py cofloor-nemoclaw-proxy.py "$HOME/.local/lib/cofloor/"
install -m 600 cofloor-vllm-proxy.service cofloor-nemoclaw-proxy.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now cofloor-vllm-proxy cofloor-nemoclaw-proxy
```

Run only one authenticated proxy on the saved port. If an existing process already owns that port, inspect it before enabling a duplicate service. Installing updated units does not replace a running process until its next service start. User lingering is already enabled on the current Spark so these services survive logout. No desktop logout, user-session termination, or model-container restart is needed for this setup.

## Discord setup from a local environment file

Add `DISCORD_TOKEN` (or `DISCORD_BOT_TOKEN`) and `DISCORD_SERVER_ID` to `~/.env` on the Spark. Set its permissions with `chmod 600 ~/.env`. The example contains only variable names; keep actual values outside Git. Then run:

```bash
bash setup-discord.sh
```

The script loads the file through Node's environment-file parser, registers Discord with NemoClaw, and rebuilds only the `cofloor` sandbox. It provides the existing local proxy token under both credential names used by NemoClaw's custom-provider rebuild preflight. This resolves the tested missing `COMPATIBLE_API_KEY` / unsafe gateway credential reuse errors without requiring another model API key. A failed command stops the script. Rebuild backs up and restores sandbox state and can take several minutes.

The bot must be invited to the server, have Message Content Intent enabled, and have View Channels, Send Messages, and Read Message History permissions. Mention the bot in the target channel after rebuilding to verify inbound and outbound chat. Bot connectivity does not establish employee mappings or wire real Discord delivery into the current dashboard's simulated decision drawer.

The three Python model test scripts also accept `MODEL_API_AUTH` from a `.env` file beside the script or in its next three parent directories. An exported environment value takes precedence, followed by the nearest nonempty file value and the legacy local credential file. These files are never uploaded by the scripts.
