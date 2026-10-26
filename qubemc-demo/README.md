# CoFloor

The Red Bull demo uses the original single-post brief: one X post, one launch image, editable source, alt text and the approved product-page link. The expanded three-post package and its 8–20-task target have been withdrawn. AI selects the compact production breakdown using the original planner and validation rules. Restart/reload the backend before a new allocation; saved runs keep their existing tasks. See [next steps](NEXT_STEPS.md).

## English project voice updates

Start project enables automatic English narration with the local Qwen Ryan voice. The independent **Voice on/off** control and current transcript remain visible when Dashboard is collapsed. **Enable audio** appears if the browser needs a user gesture; **Retry voice** retries a failed announcement without rerunning project work. Muting stops playback and discards pending announcements while text continues updating. Unmuting listens for new events. Refreshing or opening a shared run shows the latest transcript without replaying its history.

The sequence is start → validated team assignment → Alex's received leave/blocker → concrete replacement proposal → verified Discord delivery → manager confirmation → applied reassignment. A proposal names the actual replacement, task and PT schedule. Only an authenticated reply to the current proposal, followed by successful application, can announce confirmation in Discord. Local adapter confirmations are explicitly narrated as tests. Recovery clears the leave blocker; dependency-bound tasks remain scheduled, and no voice message claims completed work.

`BoardRun.narrationEvents` is optional for older runs and persists ordered `{id, sequence, kind, text, proposalVersion?, retrospectiveText?}` records with business state. `confirmation` binds the applied version to its decision and, for Discord, the sender/message/channel/reply receipt. The frontend deduplicates IDs, ignores older event sequences, cancels audio on reset, discards superseded proposals, and changes queued proposal/leave wording when confirmation has already arrived.

`POST /api/speech` accepts `{text}` (1–8000 characters) and returns `audio/wav`. The Node backend pins inference to `http://100.89.121.112:8004/v1/audio/speech`, with `model: tts-1`, `voice: Ryan`, a 180-second timeout, no redirects or remote voice fallback. Requests use the existing origin checks; audio is limited to 20 MiB. The same middleware runs in Vite and production. A TTS error leaves project state untouched and keeps the transcript/retry control available. The browser must be able to reach the app, and the app backend must reach Spark over its private network.

Verification on October 25, 2026: 76 offline tests, board contract and production build passed. An isolated browser fixture with silent WAV responses verified automatic playback, failure/retry, browser audio activation, mute/text updates and refresh without history replay. The actual Spark TTS smoke request timed out while connecting; Ryan pronunciation, real synthesis latency and a live human Discord round-trip remain unverified. No live Discord messages were sent and this change was not deployed.

## Local inference for submission review

All model execution runs on the DGX Spark. Inference clients use its private
Tailscale IP, **100.89.121.112**, not the public UI tunnel. See
[the local-inference review guide](deploy/spark/LOCAL_INFERENCE.md) for source
entry points and a reproducible, credential-free evidence command.

## First Spark deployment

Public UI: **https://cofloor.qubemc.com**. Frontend, backend, NemoClaw and model
inference run on the Spark. Start project assigns Alex to image production and
posts the team assignment in the real Discord group. The person playing Alex
replies directly to that message with the leave text below. NemoClaw proposes
specific replacements and @mentions the manager, who must reply `confirm`
directly to the current proposal before any replacement is applied.

Face recognition demo: **https://cofloor.qubemc.com/face-demo.html**. The browser
can use its own camera or upload a photo; detection and recognition run on the
Spark. Cloudflare forwards the page and same-origin `/api/face/*` requests to
CoFloor, which proxies to the loopback-only face service. See the
[face demo guide](face/README.md) for enrollment and held-out evaluation.

> I'm taking sick leave from 1–6 p.m. today and can't do this task. Please reassign it.

The configured Alex and manager Discord accounts must be different. The supplied
leave text is matched with normalized punctuation and whitespace. This demo uses
10:32 PT as the simulated report time and 13:00–18:00 PT as the leave interval;
the real Discord sender, message ID and timestamp are retained. No leave is
injected on a timer and no employee acceptance replies are fabricated.

Share the resulting `?run=...` URL to open the same run on another device. The
base URL stays idle until Start project is clicked; an explicit run link resumes
that run without creating a new allocation.
The sick-leave fact and company directory remain fictional test data.

Deployment settings, services, persistence and limitations are documented in
[the Spark deployment guide](deploy/spark/README.md#first-public-deployment).
These deployment notes supersede the historical simulated-Discord descriptions below.


A plain page URL starts with the lower Dashboard panel hidden. Swipe up with two fingers on the background (macOS natural scrolling) or click Dashboard to reveal the brief, deliverables, deadline and **Start project** button. Swipe down on the background to hide it. It stays idle until **Start project** is clicked. An explicit `?run=` link restores the shared server project and opens its panel after valid tasks load; later refresh polling does not reopen a manually collapsed panel.

Swipe up on the background to show Dashboard and down to hide it with macOS natural scrolling: positive vertical wheel delta shows it and negative hides it. Physical swipe direction follows the system scroll setting. Trackpads and mouse wheels both work; each gesture needs 60px and rearms after 250ms idle. Scrolling inside Dashboard, navigation, settings and dialogs keeps its usual behavior. Horizontal scrolling and pinch zoom are ignored.

Startup is click-gated: opening or refreshing the base URL keeps the idle launch panel hidden until a background swipe up or Dashboard click; explicit shared-run links load the existing project. Only **Start project** initiates allocation. Once clicked, allocation starts; sick leave waits for an explicit Alex group event. There is no automatic leave timer. Explicit **Reset project** hides the launch panel and waits for it to be revealed and **Start project** clicked. Saved server runs remain audit history. This supersedes earlier auto-resume-on-refresh notes.

For the persistent NemoClaw inference proxies and Discord setup from the Spark's local `.env`, see [Spark runtime helpers](deploy/spark/README.md).

Task cards, dependencies, details, activity and model messages display task text and employee names. Internal IDs remain in state/API/audit data; presentation resolves saved model text too. The original Markdown download remains unchanged.

The backdrop now follows the project: headquarters before setup, a single office floor after a successful live allocation. The imported tower, office artwork and pixel characters come from Anne's supplied `cofloor-deploy` package. Actual owner IDs, task states, leave and assignment versions drive the visual handoffs. Unknown mappings or rendering failures fall back to decorative walking; **Project settings → Ambient animation** lets you exercise that fallback. Animations do not advance work or simulate approvals. Pause the background from the header, or hide Dashboard to see the whole scene.

## Dashboard flow

**Launch panel → Start project → Assigning your team → headquarters/F90 entry → Project Dashboard.** Reveal the launch panel with a background swipe up or Dashboard click; clicking Start project hides it and begins allocation. During allocation, Anne's original 12-second scan/drop animation loops silently with its original text and names. Its duration does not determine allocation completion. An actual validated assignment result starts the F90 entry, then reveals the task board once. Failed allocation stays on the waiting screen with Retry. Pause, reduced motion or rendering failure use static fallback and do not block project entry.

The project panel emphasizes the four-column task board, current owners, deadlines and dependencies. Its side panel holds unresolved issues and the latest five observed changes, with Refresh and Activity. Pending proposals remain pending until applied; reviewing one requires a click. Duplicate snapshots do not repeat notifications. Change labels say **Observed on sync** when no event timestamp exists. Task cards briefly highlight real changes. On mobile, attention comes first, then the horizontally scrolling board and latest changes.

Ordinary Dashboard buttons/gestures are disabled during assignment, error and arrival screens. After entry they behave normally; a later refresh does not reopen a manually hidden panel. The animation asset and lifecycle are documented in [public/allocation/README.md](public/allocation/README.md).

## Current demo: live setup and sick-leave decision

**Start project** uses the configured live model to read the preloaded Red Bull document, generate production tasks and select eligible staff plus a project manager. No approval task or human assignment confirmation is required. Valid assignments enter the **In project** business state immediately; the dashboard appears after the visual entry transition. Original document approval gates and reference people are historical scenario data; the current two-moment application workflow takes precedence.

After setup, the project waits for **Alex Morgan’s Discord leave event**. There is no timed or automatically generated sick-leave message. Alex is the initial launch-image owner, validated against skills and availability. The scenario leave interval is **13:00–18:00 PT on October 26, 2026**. Only affected reservations are released; other work continues.

Alex, CoFloor and the manager share one project group. On receipt, the live model creates a concrete reassignment list and addresses the manager in that group. A validated proposal does not change owners or reserve replacements. The manager must reply **confirm** (or 确认 / 确认执行) to the current proposal; confirmation revalidates the whole list and applies it atomically. Other replies may request a revised list, which needs a new confirmation. No approval task is created.

**Real Discord transport runs through NemoClaw.** `COFLOOR_DISCORD_ALEX_ID` identifies the person playing Alex and `COFLOOR_DISCORD_MANAGER_ID` identifies the manager. Only Alex's direct reply to the recorded team-assignment message can create the leave event. Only the manager's direct reply to the current proposal can confirm it. Public HTTP callers cannot inject employee events or manager decisions in live mode. Both roles use the same configured project channel. The UI shows real delivery state and updates automatically.

**Reset project** aborts the old browser request, clears its run link and narration, and hides the launch panel. Reveal it with a background swipe up or Dashboard click, then click **Start project** to begin a fresh allocation. The base URL opens idle; an explicit shared-run URL restores that project. Saved server runs remain audit history; old timed-injection runs cannot be resumed under this workflow. Board columns remain To do / In progress / Needs attention / Done.

The server keeps authoritative per-run state and reservation history in ignored `.cofloor-runs/`; original company records remain unchanged. Do not commit this runtime directory. Restarting the server preserves saved runs. Failed setup can be reset; a fact persisted before failed analysis is reused on retry. Model task drafts get at most one schema-repair request before failure.

### Interfaces and validation

`POST /api/model/plan` takes `{runId, project:{id,workflowId}}`; `check` and `state` take `{runId}`. `check` never creates leave: it retries analysis only after a received event. `decision` takes `{runId,actorId,channelId,proposalVersion,decisionId,text}`. Snapshots expose `channelId`, `injection.status` (`waiting`, `received`, `analyzed`) and `proposal` (`version`, `status`, `updates`). Updates contain task/owner IDs and start/end timestamps; the UI resolves names and titles. The logical channel is `redbull-project`, mapped to the actual Discord channel by the NemoClaw transport.

`POST /api/model/event` takes `{runId,event:{id,type:"sick_leave",channelId:"redbull-project",actorId:"EMP-0329",text,start,end,reportedAt}}`. The upstream adapter supplies the actual message text and timestamp; start/end must be `2026-10-26T13:00:00-07:00` and `2026-10-26T18:00:00-07:00` for this scenario. Duplicate IDs or repeated reports of this scenario leave do not generate duplicate proposals. Received facts persist before inference so failures can be retried safely. Local host/origin restrictions remain; do not expose this trusted adapter API as a public webhook.

`BoardAdapter.start` emits `progress`, `snapshot` or `failed`; `request` handles state/check/decision/event. The preferred injected adapter is still `window.cofloorBoardAgent`; otherwise the built-in HTTP live adapter is used. Workflow-specific v3 live storage isolates all old reference sessions. No additional adapter installation is required for the built-in model service.

Run `npm test`, `npm run test:board`, `npm run build`. For opt-in real inference against a running server, use `COFLOOR_URL=http://127.0.0.1:5183 npm run test:model` (or the printed local URL). The live test sends the fictional project and synthetic candidate data to the configured model service and verifies allocation → explicit test Alex event → pending proposal → unresolved acknowledgement → manager confirm → validated replacement. Updated regression cases cover event deduplication, proposal versions, manager identity, changing availability, and run isolation. The local adapter smoke test is for non-live transport mode. Use real Discord replies when `COFLOOR_DISCORD=live`; do not spoof people through the HTTP adapter.

---

## Earlier dashboard: Red Bull X launch (historical)

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

Use Node 22+ (tested with Node 24). Copy `.env.example` to `.env.local`. NemoClaw is the default inference harness; direct diagnostics explicitly select `COFLOOR_INFERENCE=local` and use the Spark Tailscale endpoint. No public-gateway credential is required.

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

Local model endpoint: `http://100.89.121.112:8000/v1/chat/completions`, model `coo-llm`, matching `scripts/test_llm.py`. This is the GPU-serving container on the Spark; public inference endpoints and redirects are rejected. `MODEL_ENABLE_THINKING=true` enables longer model reasoning if desired; the default direct-answer setting reduces demo latency ([NVIDIA model guidance](https://www.nvidia.com/en-us/ai-data-science/foundation-models/nemotron/llm-info/)). The service only consumes final answer content and never sends reasoning to the UI.

## Demo and current parallel UI work

The currently changing Red Bull board is a separate UI workflow. Its document has NOT been sent to the model. Document-backed analysis is deliberately rejected by the local service pending explicit authorization for that project. The original three-workstream endpoints below are implemented and tested; the new board’s two-task contract has not been connected.

The following steps describe the original two-moment UI, not the concurrently authored board:

1. Refresh the page. Reset any previous mock run from **••• → Reset demo**.
2. Enable **Use local model** in **•••**. The header shows **Live model · Discord demo**.
3. Select **Start Project**. The actual model plans three workstreams and chooses eligible employee IDs; no mocked assignments are substituted on errors.
4. Select **View project in progress**. The real model checks current facts immediately, then every 30 seconds while monitoring. The empty initial state says **Awaiting first check**, not an invented all-clear. **Check current facts** can trigger an extra check.
5. Select **••• → Inject delayed photography**. This inserts an observation; the model decides whether it is a risk and writes the question. The UI marks the subsequent notification **DISCORD DEMO**. No actual Discord message is sent.
6. In **•••**, edit **Test worker reply** and select **Simulate worker reply**. The actual model interprets the test text. An unresolved blocker remains waiting; only a concrete acceptable commitment resumes the task. Checkpoint times come from the model's interpretation, not fixed UI text.

This historical UI used simulated transport; the current Discord transport uses NemoClaw-owned credentials. Model mode and Discord delivery are labeled separately. External real-transport adapters may still be installed as `window.cofloorAgent` (`window.qubemcAgent` is retained for compatibility).

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

The first two commands are offline checks. `test_model_flow.mjs` is an opt-in real-model integration test against the running local service: planning, an evidence-free check, an injected risk, an unresolved reply and an accepted commitment. `COFLOOR_URL` overrides the local service URL. It sends synthetic data through the configured endpoint; it does not contact Discord. The supplied `scripts/test_llm.py` can also test the provider directly over the private Tailscale network without a gateway credential.

Browser automation was blocked by the browser's URL security policy during this change; use a manual page refresh to load and verify the new mode in the live viewer.


## Retained NemoClaw integration notes

The remote NemoClaw routes and Discord bridge remain available alongside the current two-moment model demo. `/api/board/plan` is the earlier two-task approval intake; the current Dashboard uses `/api/model/plan` with run-scoped live setup.

# CoFloor

Startup is click-gated: opening or refreshing the base URL keeps the idle launch panel hidden until a background swipe up or Dashboard click; explicit shared-run links load the existing project. Only **Start project** initiates allocation. Once clicked, allocation starts; sick leave waits for an explicit Alex group event. There is no automatic leave timer. Explicit **Reset project** hides the launch panel and waits for it to be revealed and **Start project** clicked. Saved server runs remain audit history. This supersedes earlier auto-resume-on-refresh notes.

Task cards, dependencies, details, activity and model messages display task text and employee names. Internal IDs remain in state/API/audit data; presentation resolves saved model text too. The original Markdown download remains unchanged.

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

The bridge invokes `nemoclaw cofloor exec -- openclaw agent exec --local-model-lean ... --json` for planning and `openclaw message send` inside the same sandbox for Discord. It can run on the Spark with a local CLI, or from this laptop over SSH. For laptop use, copy `.env.example` to `.env.local` and set `NEMOCLAW_SSH_TARGET=dell@100.89.121.112`. SSH key auth is preferred. For an existing control socket, set `NEMOCLAW_SSH_CONTROL_PATH` to its path. `NEMOCLAW_SANDBOX` defaults to `cofloor`. The legacy `MODEL_API_AUTH` setting is unused. There is no cloud-provider fallback.

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

Starting or retrying an allocation keeps the normal allocation animation visible
for at least five seconds. Cached results are computed immediately and show
“Your team is ready” during the remaining presentation time; longer allocations
transition as soon as they finish, without an additional five-second delay.
Errors are shown immediately. D1, cache behavior, and backend execution timings
are unchanged. Opening an already saved project does not repeat this start delay.
