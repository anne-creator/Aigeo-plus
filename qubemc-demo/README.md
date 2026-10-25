# CoFloor

CoFloor is a Red Bull X launch coordination demo. The board starts with two tasks: RB-01 (launch outline) and RB-02 (direction approval). RB-02 depends on RB-01. The scenario and Bridgewell Creative directory are fictional; the business date is October 26, 2026 (America/Los_Angeles).

The **reference demo** uses the named people in the [project document](data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). The **live agent** mode validates the complete document, then sends its intake and acceptance sections with an eligibility-filtered employee shortlist to a NemoClaw-managed OpenClaw agent. Later sections cover work the board does not perform yet. The backend validates the agent's structured answer against skill, permission, client clearance, daily capacity, booking, task, and dependency rules before showing it on the board. The app can then send assignment notifications through the same NemoClaw sandbox's Discord channel. No credential goes to the browser.

The current live workflow handles intake and assignment notifications. Task execution, approval capture, later production tasks, publishing, and bidirectional board updates are future work. A Discord reply does not yet advance a Red Bull board card.

## Run the frontend

Use Node 22 or newer:

```sh
cd qubemc-demo
npm ci
npm run dev
```

For the built local service, run `npm run build && npm start`. Both servers bind to `127.0.0.1:5173`. A static `dist/` host alone cannot run the NemoClaw bridge. Enable **Use live agent** in project settings once the NemoClaw status is connected; **Start project** sends the Red Bull document to the sandbox.

## NemoClaw backend on the DGX Spark

Follow the [NemoClaw quickstart](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart) to install NemoClaw with OpenClaw and create a sandbox named `cofloor`. The Spark's existing `coo-llm` vLLM service is intended as the inference endpoint. Follow NVIDIA's [OpenAI-compatible endpoint guide](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/custom-endpoints/set-up-openai-compatible-endpoint): use a loopback-bound endpoint and select `NEMOCLAW_PROVIDER=custom`, `NEMOCLAW_ENDPOINT_URL=http://localhost:18000/v1`, `NEMOCLAW_MODEL=coo-llm`, `NEMOCLAW_COMPATIBLE_AUTH_MODE=none`, and `NEMOCLAW_VLLM_PORT=18000`. The existing vLLM listener is bound to the Tailscale address on port 8000, so a loopback-only proxy to that listener is needed before onboarding. Verify `/v1/models`, streaming, and tool calling on the proxy first. Do not expose the no-auth proxy beyond loopback.

The bridge invokes `nemoclaw cofloor exec -- openclaw agent exec --local-model-lean ... --json` for planning and `openclaw message send` inside the same sandbox for Discord. It can run on the Spark with a local CLI, or from this laptop over SSH. For laptop use, copy `.env.example` to `.env.local` and set `NEMOCLAW_SSH_TARGET=dell@100.89.121.112`. SSH key auth is preferred. For an existing control socket, set `NEMOCLAW_SSH_CONTROL_PATH` to its path. `NEMOCLAW_SANDBOX` defaults to `cofloor`. The legacy `MODEL_API_AUTH` setting only supports the older three-task model API; it is not used by the Red Bull board's NemoClaw planning path.

## Discord setup

Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications), enable the Message Content intent, invite it to your server with permission to view the target channel, send messages, and read message history. Copy the server ID and the target channel ID with Developer Mode. Configure the bot token and server ID **in NemoClaw**, following [NVIDIA's Discord setup](https://docs.nvidia.com/nemoclaw/user-guide/openclaw/manage-sandboxes/messaging-channels/set-up-discord). The token belongs in NemoClaw's channel configuration, never in this repo or the app `.env.local`. NemoClaw defaults to responding only when mentioned in a configured server.

In the app's ignored `.env.local`, set `NEMOCLAW_DISCORD_CHANNEL_ID` and `NEMOCLAW_EMPLOYEE_MAP` as a JSON object mapping assigned employee IDs to real Discord user IDs. These mappings are needed to mention the assigned people. Example (replace IDs):

```dotenv
NEMOCLAW_DISCORD_CHANNEL_ID=123456789012345678
NEMOCLAW_EMPLOYEE_MAP={"EMP-0254":"234567890123456789","EMP-0311":"345678901234567890"}
```

The live board records whether notifications were sent or why they failed. A configured mapping does not prove that a Discord bot is online; verify one real send before the demo. No simulated notification is labeled as sent.

## Verification

```sh
npm test
npm run test:board
npm run build
```

The tests cover the intake contract, eligibility boundary, NemoClaw command shape, and fail-closed Discord configuration. A live end-to-end test needs the running NemoClaw sandbox, the local vLLM route, and a configured Discord bot.
