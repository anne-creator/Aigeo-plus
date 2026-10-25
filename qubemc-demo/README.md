# CoFloor

Local English dashboard for two moments: project planning / assignment, and issue detection / worker decision. White background, cyan accents, factual labels.

## Run

```sh
npm ci
npm run dev
```

Open the printed localhost URL. `npm run build` creates `dist/`. No hosted backend or external runtime assets are required. The Vite server serves the frontend locally.

## Walk through

1. Select **Start Project**. The development adapter emits planning events and three example task assignments.
2. Select **View project in progress** to skip the off-screen execution stage.
3. Open **••• → Inject delayed photography**. Wait for the simulated notification; the dashboard stays waiting for a decision.
4. Select **••• → Simulate worker reply**. The reply and resulting commitment update the task; its owner stays the same.
5. **••• → Reset demo** starts over. Refresh preserves the current state. An interrupted operation requires a reset, rather than pretending it completed.

All current model results and Discord messages are development fixtures. There is no actual inference or Discord transmission yet.

## Local Agent connection

`src/agent.ts` exports the `AgentAdapter` interface. `src/data.ts` holds the project fixture and imported company input. The company now comes from Anne’s provided Bridgewell Creative dataset: 1,000 employees, 17 departments, 72 roles and 99 teams. `src/company-data.json` is the compact frontend projection; complete source records and schedules are retained in `data/company/`. Stable employee IDs replace the previous generated employees. The source explicitly labels its data synthetic. The mocked three-person assignments (Taylor Reed, Alex Morgan and Jordan Brooks) remain development examples, not model selections.

Availability refers to October 26, 2026, the source reference day, in America/Los_Angeles. Remaining daily capacity is not task-window feasibility. `CompanyInput.source.resources` supplies local source paths for later model integration. The storage key includes dataset ID, so sessions containing the old invented employee IDs do not overwrite this dataset. See `data/company/README.md` for provenance and import instructions.

Implement the adapter in the same project when the local runtime details are provided. Install it as `window.cofloorAgent` before the app mounts; set `mode: 'live'`. The **Use local runtime** control selects that adapter; a missing runtime produces a visible error and never falls back to mock.

Existing integrations using `window.qubemcAgent` remain supported; `window.cofloorAgent` takes precedence. Existing browser storage keys are retained to preserve saved project state and runtime selection. The source directory remains `qubemc-demo/` for compatibility with current local workflows. The new logo is pending Anne’s review; the dashboard uses the CoFloor wordmark.

- `start({ project, company, runId }, signal)` yields `progress` and `planned` events from real inference.
- `check({ project, company, state, observation }, signal)` consumes current runtime state; `observation` is empty in live mode. It yields `issue`, then `sent` only after actual transport success. Live **Check latest project state** calls this method.
- Optional `subscribe(onEvent)` delivers asynchronous observations and genuine Discord replies. Return an unsubscribe function. An `issue` event can arrive while monitoring; a `reply` changes waiting to interpreting; `resolved` records the model's commitment only after a worker reply. Model-provided `nextCheckIn` is optional.
- `receiveDecision({ state, text }, signal)` is used by the development reply control. A production bridge should feed only genuine incoming replies through its subscribed events or this boundary.
- All events carry a stable event `id` and current `runId`. Preserve IDs on redelivery. Reset cancels pending calls; stale and duplicate events are ignored.

No HTTP, model provider, Python bridge, or Discord protocol is assumed. Connect to the actual local runtime here after its information arrives. Do not implement model calls inside UI components. Do not substitute the development controls for real notifications in live mode.

The underlying facts and decision contents stay in the events. The UI exposes task owners, deadlines, issue facts, messages and next steps; internal matching and orchestration stay behind the scenes. Reassignment is P1.

## Verification

`npm test` checks stale events, duplicates, waiting until a reply, owner preservation, persistence and interrupted runs. `npm run build` includes strict TypeScript validation. Browser walkthrough verifies both moments, reload recovery and unavailable live runtime errors.
