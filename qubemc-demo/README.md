# CoFloor app

This directory contains the React frontend and Node.js backend. Start with the [project overview](../README.md) for the demo flow and architecture; this guide covers running and developing the app.

## Requirements

- Node.js 22+ and npm.
- The full repository: build scripts stage animation assets from `../assets/`.
- For live allocation: the local Nemotron and D1 services, a running NemoClaw `cofloor` sandbox, and its local inference route.
- For the Discord flow: a configured bot, a project channel, and separate real users playing Alex and the manager.
- For optional voice and face features: the corresponding local services.

The original Spark's public tunnel was temporary and is not a permanent demo URL. A deployment is accessible only while its host and services are running.

## Start development

Run from this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure `.env.local` for your runtime before starting a live project. The primary settings are:

```dotenv
COFLOOR_INFERENCE=nemoclaw
NEMOCLAW_SANDBOX=cofloor
NEMOCLAW_PLANNER_CONFIG=/sandbox/.openclaw/cofloor-planner.json

COFLOOR_DISCORD=live
NEMOCLAW_DISCORD_CHANNEL_ID=<numeric channel ID>
COFLOOR_DISCORD_ALEX_ID=<numeric Alex user ID>
COFLOOR_DISCORD_MANAGER_ID=<numeric manager user ID>
```

When developing on a laptop with NemoClaw on the Spark, also set `NEMOCLAW_SSH_TARGET=dell@100.89.121.112` and configure SSH access. On the Spark itself, omit that setting.

Keep secrets in ignored local files. The Discord token is configured through NemoClaw, not sent to the browser. See [Spark runtime helpers](deploy/spark/README.md) for proxy services, planner configuration, Discord setup, and the D1 sandbox policy. Those helpers describe the original installation and contain machine-specific paths and historical deployment settings; adapt them to your host.

The original inference services use the Spark's private Tailscale address `100.89.121.112`: Nemotron on port `8000`, D1 on `8001`, and Qwen TTS on `8004`. Some routes are deliberately pinned in code. Rehosting requires reviewing those routes and the sandbox policy, not simply changing a public domain. See [local-inference verification](deploy/spark/LOCAL_INFERENCE.md).

## Exercise the live demo

1. Open the app and click **Start project**. Allocation runs in a background job; repeated eligible inputs can use a validated cache. The allocation screen remains visible for at least five seconds before the office-entry transition.
2. Open **Dashboard** to inspect assigned tasks, dependencies, and deadlines. NemoClaw sends the team announcement to the configured Discord channel.
3. From Alex's configured account, reply directly to that announcement:

   > I'm taking sick leave from 1–6 p.m. today and can't do this task. Please reassign it.

4. Wait for CoFloor's concrete replacement proposal. From the manager's configured account, reply directly to that proposal with `confirm`.
5. Verify the updated owners and activity on the dashboard. Voice controls allow muting, enabling browser audio, or retrying narration without rerunning project work.

The demo business date is October 26, 2026, in America/Los_Angeles. Alex's leave covers 13:00–18:00 PT. These are scenario facts; Discord sender identities and message receipts are real. Leave is never injected automatically.

Initial allocation uses Nemotron for task planning and D1 for owner selection. Reassignment uses D1 through NemoClaw to choose among complete plans validated by the coordinator. A proposal does not change owners until the manager confirms it and the backend revalidates it. Wrong senders, stale proposal replies, and duplicate events cannot authorize a new reassignment.

A `?run=...` URL opens an existing server run. The base URL starts idle. Failed allocation jobs support retry without creating another run.

## Build and serve

```sh
npm run build
npm start
```

The production server serves both the frontend and API, binding to `127.0.0.1:5173` by default. Hosting `dist/` alone is insufficient for the agent workflow. If publishing your own deployment, configure its public origin and reverse proxy or tunnel separately.

Runtime state lives in ignored `.cofloor-runs/`, including saved runs, jobs, and the allocation cache. Preserve this directory across releases. Model weights, enrolled face data, credentials, and runtime state do not belong in Git.

## Validate

```sh
npm test
npm run test:board
npm run build
```

These are offline checks. Real inference and Discord connectivity require separate integration checks against your configured runtime.

Useful additional scripts in `scripts/` include `benchmark_allocation.mjs` and `benchmark_reassignment.mjs`. The reassignment benchmark exercises real local inference with mocked Discord, so its timings exclude Discord network latency. Read the scripts' configuration requirements before running them; they require existing runtime services and fixtures.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/redbull-agent.ts` | Dashboard and browser/backend integration |
| `server/model.mjs`, `server/project.mjs` | API routing and authoritative project coordination |
| `server/decision.mjs` | D1 selection and validated replacement plans |
| `server/plan-jobs.mjs`, `server/allocation-cache.mjs` | Durable allocation jobs and reusable validated plans |
| `server/nemoclaw-discord.mjs`, `server/project-discord.mjs` | NemoClaw transport and Discord workflow |
| `server/speech.mjs` | Local TTS proxy |
| `face/` | Optional local face-recognition service and setup guide |
| `deploy/spark/` | Runtime helpers and local-inference evidence |
| `data/` | Fictional company records and project brief |

The optional face welcome flow is available at `/face-demo.html` on your running app. Recognition runs locally; the subsequent avatar animation is illustrative. It is not production authentication, role-based access control, or liveness detection. See the [face guide](face/README.md) for enrollment and evaluation.
