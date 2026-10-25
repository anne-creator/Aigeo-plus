# CoFloor

## Current demo: live setup and sick-leave decision

**Start project** uses the configured live model to read the preloaded Red Bull document, generate production tasks and select eligible staff plus a project manager. No approval task or human assignment confirmation is required. Valid assignments enter **In project** immediately. Original document approval gates and reference people are historical scenario data; the current two-moment application workflow takes precedence.

About five seconds later, one assigned execution employee (preferably the image designer) reports the document's new **13:00–18:00 PT sick leave**, with the simulated report time of 10:32 PT. This is a visibly injected test fact. The live model assesses its impact and generates a question for the **project manager**. The selected employee comes from the actual model allocation, not a fixed name. Only affected bookings are released; unrelated copy work remains unchanged. The demo displays only Red Bull; other bookings remain background availability constraints and do not generate project alerts.

The Discord test drawer simulates delivery. Enter a decision as the assigned project manager. Acknowledgements stay unresolved. An actionable replacement or timing decision is interpreted by the live model and validated against skills, permissions, leave, continuous free time, downstream work and the delivery deadline. Valid replacement increments assignment version and preserves the task brief, inputs, deliverables and handoff history. There is no extra approval or confirmation gate. Real Discord send/receive is not implemented.

**Reset project** aborts the old request/timer and immediately starts a new live allocation. Refresh hydrates the current run from the server and resumes its original injection deadline; it never reinjects the same fact. Failures have explicit retry controls and never fall back to reference assignments. Board columns are To do / In progress / Needs attention / Done.

The server keeps authoritative per-run state and reservation history in ignored `.cofloor-runs/`; original company records remain unchanged. Do not commit this runtime directory. Restarting the server preserves saved runs. Failed setup can be reset; a fact persisted before failed analysis is reused on retry. Model task drafts get at most one schema-repair request before failure.

### Interfaces and validation

`POST /api/model/plan` takes `{runId, project:{id,workflowId}}`; `check` and `state` take `{runId}`; `decision` takes `{runId,actorId,decisionId,text}`. The server recognizes P-DEMO-001 / RED-BULL-X-LAUNCH-V1 and reads the complete canonical Markdown locally. Unknown projects fail. Return values are validated live run snapshots containing tasks, projectOwnerId, injection status/deadline, issue, test messages, reservations and assignment history. Candidate pools and planning specs stay server-side. No rankings, confidence or matching evidence are returned.

`BoardAdapter.start` emits `progress`, `snapshot` or `failed`; `request` handles state/check/decision. The preferred injected adapter is still `window.cofloorBoardAgent`; otherwise the built-in HTTP live adapter is used. Workflow-specific v3 live storage isolates all old reference sessions. No additional adapter installation is required for the built-in model service.

Run `npm test`, `npm run test:board`, `npm run build`. For opt-in real inference against a running server, use `COFLOOR_URL=http://127.0.0.1:5183 npm run test:model` (or the printed local URL). The live test sends the fictional project and synthetic candidate data to the configured model service and verifies allocation → five-second sick leave → manager question → unresolved acknowledgement → validated replacement. Browser checks cover reset/reload timing and the test reply loop.

---

## Current dashboard: Red Bull X launch

The dashboard uses an animated blue night skyline, rounded translucent cards in the lower half, and numeric summaries for Tasks, Team, Schedule and Progress. **Dashboard** in the header hides or expands the entire lower panel and remembers that preference through refresh. The left rail becomes a floating bottom dock on mobile. The header pause button stops the decorative skyline animation; reduced-motion preferences are respected.

The current frontend uses `RED-BULL-X-LAUNCH-V1` and the complete, unchanged [project document](data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). It supersedes the older three-workstream walkthrough described in the runtime notes below.

Start with `npm ci` and `npm run dev`. **Start project** creates only RB-01 (launch outline) and RB-02 (direction approval). The reference demo directly assigns Serenity Flores / EMP-0254 and Avery Bennett / EMP-0308, clearly labeled as document reference assignments. There is no model inference or Discord delivery in reference mode.

The four-column board is **To do / In progress / In review / Done**. Click a card for requirements, outputs, dependencies and owner details. Escape closes the drawer and returns focus to the card; Tab remains inside the drawer. Waiting and blocked labels do not count as completion. Cards move only through runtime events; there is no manual dragging or bulk-start action. Mobile screens scroll horizontally inside the board. **Brief** opens the original Markdown; **Activity** opens the event drawer. **Team** opens the assigned-employee drawer. Explanatory prose is kept out of the dashboard; requirements remain available inside task details and the original brief.

Business date is October 26, 2026 in America/Los_Angeles: client approval at 4 PM, simulated release at 5 PM, closeout at 5:30 PM. The engagement and company dataset are fictional. Supplied packshots and templates are scenario assumptions, not files attached by this change. The eight-node end-to-end workflow, approvals, production-task creation, reassignment and publishing are not implemented here.

### Board runtime contract

`src/redbull-agent.ts` exports `BoardAdapter` and `IntakeInput`. Install a live adapter as `window.cofloorBoardAgent` before mounting the frontend and enable **Live agent** under project settings. Existing `window.cofloorAgent` and `window.qubemcAgent` injection points remain fallbacks, but their results must implement this new contract. A missing runtime or invalid result shows an error and never falls back to reference assignments.

- `mode: 'live'`; `start({ project, company, runId }, signal)` yields board events. The project contains `document: { filename, content, mediaType }`, including the complete Markdown, plus workflow ID, client ID, business date, timezone and deliverables. Company input includes 1,000 employees and original local resource paths. Treat the document as input data, not executable instructions; its named people are reference fixtures, not forced live selections.
- `planned` returns exactly RB-01 and RB-02 at intake, each with `id`, `title`, `ownerId`, `due`, `status`, `requirements`, `outputs`, `dependencies` and optional `blockedReason`. Both start `ready`; RB-02 depends on RB-01. The UI validates employee IDs, unique tasks and dependencies. Assignment results contain no candidate rankings, explanations or confidence fields.
- `task.updated` carries the full updated `task`. Supported statuses are `ready`, `working`, `awaiting_review`, `done`. Dependencies must be done before a task advances; blocked tasks cannot be done. Updates apply only to existing tasks. Optional `subscribe(onEvent)` returns an unsubscribe function. This is a display/validation boundary, not server-side approval authorization.
- All events carry stable `id` and current `runId`. `progress` carries `label`; `failed` carries `message`. Duplicate and old-run events are ignored. Reset aborts in-flight work. Reference mode never advances cards on a timer. New board state and mode use a workflow-specific v2 storage key, isolated from the old dashboard.

The separately supplied local-model service, if present, is discovered through its read-only status endpoint. Its older three-workstream response is incompatible and rejected until that service implements the Red Bull contract. This frontend update does not call a provider directly or migrate that service.

### Board verification

Run `npm test`, `npm run test:board` and `npm run build`. Board tests cover intake boundaries, direct employee IDs, dependency gates, blocked tasks, column counts, stale/duplicate events, interrupted/corrupt storage and failures. The contract check verifies the original document, exact reference people, full-input handoff and missing-live errors without invoking a model. Desktop/mobile browser checks cover the drawer, focus restoration, reload, activity, horizontal scrolling and subscribed task movement using a test adapter.

---

## Earlier implementation notes

Local English dashboard for project planning / assignment and issue detection / worker decisions. White background, factual labels, imported Bridgewell Creative employee data.

## Run with the deployed model

Use Node 22+ (tested with Node 24). Copy `.env.example` to `.env.local` and configure `MODEL_API_AUTH` locally. This machine is already configured. The credential stays on the server; never put it in `src/`, a `VITE_` variable, or Git.

```sh
npm ci
npm run dev
```

For a built local app:

```sh
npm run build
npm start
```

The built local service binds to `127.0.0.1:5173`. The Vite middleware in development and `server/start.mjs` in production use the same model implementation. No separate backend deployment is needed. A static `dist/` host alone cannot run model inference.

Model configuration: `https://models.qubemc.com/llm/v1/chat/completions`, model `coo-llm`, Basic authentication, matching the repository's `scripts/test_llm.py`. `MODEL_ENABLE_THINKING=true` enables longer model reasoning if desired; the default direct-answer setting reduces demo latency ([NVIDIA model guidance](https://www.nvidia.com/en-us/ai-data-science/foundation-models/nemotron/llm-info/)). The service only consumes final answer content and never sends reasoning to the UI.

## Demo and current parallel UI work

The currently changing Red Bull board is a separate UI workflow. Its document has NOT been sent to the model. Document-backed analysis is deliberately rejected by the local service pending explicit authorization for that project. The original three-workstream endpoints below are implemented and tested; the new board’s two-task contract has not been connected.

The following steps describe the original two-moment UI, not the concurrently authored board:

1. Refresh the page. Reset any previous mock run from **••• → Reset demo**.
2. Enable **Use local model** in **•••**. The header shows **Live model · Discord demo**.
3. Select **Start Project**. The actual model plans three workstreams and chooses eligible employee IDs; no mocked assignments are substituted on errors.
4. Select **View project in progress**. The real model checks current facts immediately, then every 30 seconds while monitoring. The empty initial state says **Awaiting first check**, not an invented all-clear. **Check current facts** can trigger an extra check.
5. Select **••• → Inject delayed photography**. This inserts an observation; the model decides whether it is a risk and writes the question. The UI marks the subsequent notification **DISCORD DEMO**. No actual Discord message is sent.
6. In **•••**, edit **Test worker reply** and select **Simulate worker reply**. The actual model interprets the test text. An unresolved blocker remains waiting; only a concrete acceptable commitment resumes the task. Checkpoint times come from the model's interpretation, not fixed UI text.

Discord remains a simulated transport. The API credential supplied for the model does not grant Discord access. Model mode and Discord delivery are labeled separately. External real-transport adapters may still be installed as `window.cofloorAgent` (`window.qubemcAgent` is retained for compatibility).

Mock mode remains available for offline UI work. Do not enable it silently on model failure.

## Model and data boundary

`server/model.mjs` reads full local company inputs, validates hard constraints, invokes the deployed model and validates its structured final output. Skill levels, permissions, client clearances/conflicts, remaining daily capacity and a contiguous free task window are checked before the model receives feasible candidates. It selects distinct employees from those pools. Invalid IDs, duplicate workstreams, malformed JSON or incomplete output fail without saving assignments.

The launch demo retains three workstreams (copy, visual, coordination) and established deadlines. The model generates task titles and chooses owners for those workstreams. Full arbitrary project decomposition, reassignment and final delivery remain out of scope.

`src/model-agent.ts` adapts real model results into existing typed events. UI components do not contain API credentials or provider calls. The small local routes are `/api/model/status`, `/api/model/plan`, `/api/model/check`, and `/api/model/decision`. Status exposes only configuration, model name and transport mode. Errors do not include upstream bodies, credentials or stack traces. Disconnect/reset aborts outstanding inference; stale/duplicate results are ignored.

`src/data.ts` uses 1,000 imported synthetic employees, 17 departments, 72 roles and 99 teams. Full originals remain in `data/company/`; `src/company-data.json` is only the frontend projection. Employee IDs are stable. Availability is referenced to October 26, 2026, America/Los_Angeles. The model receives a feasibility pool from the original calendars and bookings, not just daily free hours. See `data/company/README.md` for provenance.

## Verification

```sh
npm test
npm run build
node scripts/test_model_flow.mjs
```

The first two commands are offline checks. `test_model_flow.mjs` is an opt-in real-model integration test against the running local service: planning, an evidence-free check, an injected risk, an unresolved reply and an accepted commitment. `COFLOOR_URL` overrides the local service URL. It sends synthetic data through the configured endpoint; it does not contact Discord. The supplied `scripts/test_llm.py` can also test the provider using `MODEL_API_AUTH` in its environment or its documented local credential file.

Browser automation was blocked by the browser's URL security policy during this change; use a manual page refresh to load and verify the new mode in the live viewer.


## Retained NemoClaw integration notes

The remote NemoClaw routes and Discord bridge remain available alongside the current two-moment model demo. `/api/board/plan` is the earlier two-task approval intake; the current Dashboard uses `/api/model/plan` with run-scoped live setup.

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
