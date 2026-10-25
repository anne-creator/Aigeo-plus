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

## First public deployment

The Spark runs the built frontend and Node backend together at
`127.0.0.1:5173`, under `cofloor-app.service`. Cloudflare tunnel `builderbase`
routes `cofloor.qubemc.com` to that listener; the existing model routes remain intact.

Deployment layout:

- `~/cofloor/current`: symlink to the active release (initial release: `releases/phase1`).
- `~/cofloor/app.env`: private service settings, mode 600.
- `current/.cofloor-runs/`: authoritative persisted run data and Discord receipts.
  Preserve this directory when changing releases; it is never committed.
- `~/.config/systemd/user/cofloor-app.service`: service installed from this directory.

Service settings (no bot token belongs in the app):

```dotenv
PORT=5173
COFLOOR_INFERENCE=nemoclaw
COFLOOR_DISCORD=live
COFLOOR_PUBLIC_ORIGIN=https://cofloor.qubemc.com
NEMOCLAW_SANDBOX=cofloor
NEMOCLAW_PLANNER_CONFIG=/sandbox/.openclaw/cofloor-planner.json
NEMOCLAW_DISCORD_CHANNEL_ID=<channel ID>
COFLOOR_DISCORD_MANAGER_ID=<numeric Discord user ID>
```

Run `configure-planner.cjs` with `nemoclaw cofloor exec -- node` inside the
sandbox to create the dedicated planner configuration. It derives provider
settings from the existing OpenClaw config, disables tools for structured planning,
and sends `enable_thinking:false` to the local model. It does not modify the
Discord gateway's configuration. Repeat after a sandbox rebuild if necessary.
The complete project brief remains input; candidate lists sent to the model are
bounded to 12 per task, and all output is checked against the full feasibility pool.

For this first round, one real Discord account represents the model-selected
fictional project manager. Reply directly to the bot question. Only that account's
non-bot replies to recorded messages are accepted. Web decision submissions are
disabled in live mode. The server polls pending runs even with no browser open;
the open UI refreshes its run every five seconds. Delivery receipts survive app
restarts. A receipt stuck at `sending` requires inspecting Discord before any
manual resend, to avoid duplicating an ambiguously delivered message.

Inspect/restart only the app:

```sh
systemctl --user status cofloor-app
journalctl --user -u cofloor-app -n 50
systemctl --user restart cofloor-app
```

Do not terminate desktop sessions or reboot the Spark for app deployment.
The public UI has no login in this initial deployment; only the configured
Discord manager can approve staffing changes through the live workflow.

### One owner for Discord replies

The coordination channel must not also trigger OpenClaw's general chat agent.
Otherwise a human reply runs through both the dashboard coordinator and the
long-lived chat session; the latter can exceed the local model context and post
compaction errors even after the project decision succeeded.

Keep the channel enabled for explicit message actions. Configure its native
`channels.discord.guilds.<server>.channels.<channel>.users` allowlist to contain
only the bot's own numeric ID, with bot-originated turns disabled (`allowBots:false`).
This blocks human-triggered general chat turns in this channel while retaining
NemoClaw's explicit message send/read operations. The app separately checks the
real manager ID before interpreting a reply. Preserve existing channel entries;
if adding the first channel map, retain `"*":{"enabled":true}` to preserve other
channels' previous behavior. Do not set this channel's `enabled:false`: that also
blocks explicit message read/send. The gateway hot-reloads channel configuration.
Verify `openclaw message read` after applying it. Repeat this setting after any
onboarding/rebuild that replaces channel configuration.

Confirmed decisions send a completion notice without requesting another reply.
