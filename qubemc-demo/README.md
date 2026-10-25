# CoFloor

## Current dashboard: Red Bull X launch

The current frontend uses `RED-BULL-X-LAUNCH-V1` and the complete, unchanged [project document](data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). It supersedes the older three-workstream walkthrough described in the runtime notes below.

Start with `npm ci` and `npm run dev`. **Start project** creates only RB-01 (launch outline) and RB-02 (direction approval). The reference demo directly assigns Serenity Flores / EMP-0254 and Avery Bennett / EMP-0308, clearly labeled as document reference assignments. There is no model inference or Discord delivery in reference mode.

The four-column board is **To do / In progress / In review / Done**. Click a card for requirements, outputs, dependencies and owner details. Escape closes the drawer and returns focus to the card; Tab remains inside the drawer. Waiting and blocked labels do not count as completion. Cards move only through runtime events; there is no manual dragging or bulk-start action. Mobile screens scroll horizontally inside the board. **Brief** opens the original Markdown; **Activity** opens the event sidebar.

Business date is October 26, 2026 in America/Los_Angeles: client approval at 4 PM, simulated release at 5 PM, closeout at 5:30 PM. The engagement and company dataset are fictional. Supplied packshots and templates are scenario assumptions, not files attached by this change. The eight-node end-to-end workflow, approvals, production-task creation, reassignment and publishing are not implemented here.

### Board runtime contract

`src/redbull-agent.ts` exports `BoardAdapter` and `IntakeInput`. Install a live adapter as `window.cofloorBoardAgent` before mounting the frontend and enable **Use live agent** under project settings. Existing `window.cofloorAgent` and `window.qubemcAgent` injection points remain fallbacks, but their results must implement this new contract. A missing runtime or invalid result shows an error and never falls back to reference assignments.

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
