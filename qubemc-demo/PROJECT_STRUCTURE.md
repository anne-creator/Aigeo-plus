# CoFloor Project Structure

## Live two-moment workflow (2026-10-25)

This section supersedes the earlier reference-intake and approval-workflow notes.

- `server/project.mjs`: canonical document input, live production-task decomposition and assignment, project manager selection, feasibility validation, durable per-run state, once-only five-second sick leave, decision interpretation, reservation release/rebooking and assignment/handoff history. Working copies stay in ignored `.cofloor-runs/`. All source company files remain unchanged.
- `server/model.mjs`: existing model connection plus run-scoped plan/check/decision/state routing. Preloaded Red Bull setup is explicitly supported; no blanket document authorization rejection. Credentials remain server-only and the configured HTTPS host allowlist remains enforced.
- `src/redbull-agent.ts`, `src/board-state.ts` and the current dashboard: built-in live HTTP adapter, validated snapshots, v3 live storage, automatic In project entry, timer recovery, manager dialogue and immediate reallocation on Reset. Board status attention replaces the old review gate.

`Start project` → model decomposes execution work → eligible candidate pools → model selects owners and a dispatch-capable project manager → validate/reserve/save → In project → about five seconds → persist a newly reported 13:00–18:00 PT sick leave for the selected designer → release affected reservations → model asks PM → test-channel manager decision → model proposes updates → validate/rebook/version increment → continue. No approval stage and no fabricated inference. Acknowledgement-only replies cannot restore work. Only Red Bull is displayed; background bookings constrain staffing without generating other-project incidents. Old external-conflict alerts are removed when saved runs are loaded.

The source document's original reference ranking, named actors and eight-node approval flow are retained as source data, not UI requirements. The dynamic plan does not return rankings or evidence; original brief/inputs and outputs survive handoff. Real Discord is outside this change: delivery and manager input are explicitly labeled simulated/test.

Validation: server/state regression tests, canonical-document and adapter contract check, strict TypeScript/build, desktop/mobile browser test with mocked transport, and opt-in genuine-model integration script. Coverage includes early/once-only injection, refresh recovery, sick employee exclusion, manager identity, reservation/history preservation, single-project scope, vague/invalid decisions, assignment versions, cancellation and reset run isolation.

---

## Current presentation: collapsible glass dashboard (2026-10-25)

- Night skyline background: `src/NightCity.tsx` renders deterministic SVG towers, blue roof lights, layered skyline, window lights and a drifting light band behind the panels. CSS animates opacity and transforms without timers or network media. The header pause/play control stops the scene; reduced-motion preferences disable animation. Night-scene contrast uses 45% scene brightness and 70% saturation; glass has 5% white tint / 48 px blur and slightly desaturated backdrops, with a lighter shadow and fine edge highlight for clearer transmission. Titles and key numbers use weight 600, with weight 500 labels. This brings the dark neutral glass and bright text closer to the supplied Wealth reference while retaining transmitted blue light. Production build and browser pause/play checks pass.

- Transparency correction: all five dashboard panels share a 10.7% white tint with 30 px backdrop blur; removed the 83–90% opaque dark fills and adjusted text for the white stage. Panel backgrounds transmit the scene beneath them; text and controls stay fully opaque. No project logic changes.

- `src/main.tsx` and `src/kanban.css`: Wealth-inspired rounded glass cards, circular navigation and a bottom-anchored dashboard over an animated blue night skyline. The scene uses local SVG/CSS and has no external image or walking characters. Retains the React project and its existing runtime; the supplied HTML brief is a visual reference, not a replacement finance application.
- Tasks, Team, Schedule, Progress and the four-column task board share one lower panel. Metrics derive from the existing board/company/project inputs; there are no invented financial figures or fake progress. Dashboard descriptions, explanatory empty states and promotional copy are removed. Task requirements and the unchanged original brief remain accessible in dialogs.
- The header Dashboard button hides or expands the whole lower panel. `cofloor-dashboard:expanded` stores only that presentation preference; hiding never resets tasks or aborts a live subscription. The left rail and mobile bottom dock retain access to the dashboard, board, team, document, activity and settings. Team and activity use focus-contained dialogs. The board scrolls internally to preserve the lower-panel height when several cards occupy one column.
- Desktop targets the supplied 1341 × 958 proportions with CSS `--u`; smaller screens use a multi-column layout and then a single scrolling column. Reduced motion is respected.
- Project state transitions, dependency gates, reference assignments, data, adapter selection, server routes and credentials are unchanged. Read-only local status returned `configured: true`, model `coo-llm`, Discord `demo`. The existing local model service still rejects document-backed intake and uses the older three-workstream contract; this UI change does not claim the Red Bull board is connected to live inference.
- Validation: strict TypeScript and production build; 7 board tests, the board contract check and 13 existing data/state/model tests pass. Browser checks cover reference start, task detail, hide/show, hidden preference through refresh, desktop and 390 px mobile layouts. No live project document was submitted. Work stays local; no commit or push per Anne's instruction.


## Current feature: Red Bull document and Kanban board (2026-10-25)

This section describes the current UI and supersedes the earlier dashboard workflow notes below. Existing local-model integration notes are preserved for their separate implementation.

### Structure and data flow

- `src/main.tsx` and `src/kanban.css`: bottom-anchored glass project dashboard over a white stage; numeric summaries; four status columns; direct assigned owners; document, task, team and activity dialogs; persistent whole-panel collapse; mobile board scrolling.
- `src/redbull-project.ts` and `data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md`: project metadata and the unchanged source document, bundled as raw text and passed in full to the runtime. Document instructions are data, not executed commands.
- `src/redbull-agent.ts`: reference intake plus the typed BoardAdapter boundary; preferred `window.cofloorBoardAgent`, compatible legacy injection points, and optional read-only discovery hooks for a separately installed model service.
- `src/board-state.ts`: isolated v2 snapshot, four statuses, event-driven card updates, ID/dependency validation, duplicate/stale protection and interrupted-run recovery. Earlier `src/state.ts` remains available to the separate legacy service.
- `src/board-state.test.ts` and `scripts/test_board_contract.mjs`: state/gate tests and full-document/adapter contract checks. `src/vite-env.d.ts` supplies raw-import types.

Document + project metadata + company input → BoardAdapter → validated planned/task.updated events → board reducer → Kanban cards and activity. Assignments expose owners directly; no rankings, matching explanations or confidence fields. `task.updated` replaces a complete existing task. Unknown legacy event kinds are ignored.

### Behavior and scope

Intake creates only RB-01 and RB-02. Reference people are Serenity Flores / EMP-0254 and Avery Bennett / EMP-0308; live results can choose different valid employee IDs. RB-02 waits for RB-01. Both start in To do; only agent events move them. Blocked tasks cannot complete; unmet dependencies prevent advancement. Empty columns remain visible. There is no global start, manual dragging, photography-delay injection or invented completion.

Full approved-outline decomposition, production workflow, server approval authorization, reassignment, Discord and simulated release remain future integration work. The supplied older three-workstream backend is preserved separately and its plan is rejected by the new intake validator until adapted. No genuine inference is claimed for reference assignments or test adapters.

Company data is unchanged: 1,000 employees, 17 departments, 72 roles, 99 teams and all original source hashes. Added project ID P-DEMO-001 / workflow RED-BULL-X-LAUNCH-V1 uses the October 26, 2026 simulated business date in America/Los_Angeles. UI storage is separate from all earlier snapshots.

### Validation and maintenance

`npm test`, `npm run test:board`, `npm run build`; document/contract tests perform no real inference. Browser checks verify desktop and 390 px mobile layouts, original-text display, direct employee cards, dependency tags, dialog focus containment/restoration, refresh, activity, missing-runtime errors and automatic movement using an injected test adapter.

- 2026-10-25: Added original Red Bull document, direct reference assignments and full-document live handoff; replaced the current task panel with an event-driven four-column Kanban board and accessible drawers. Unrelated local-model files and other projects are excluded from this feature commit.

---

## Earlier implementation notes

## Project Structure

Single local React + TypeScript + Vite project with a built-in Node model service. The deployed coo-llm model is now connected; Discord remains simulated.

- `src/main.tsx`: factual English dashboard, two presentation moments, secondary development controls.
- `src/state.ts`: shared input / event types, state transitions, persistence recovery and event deduplication.
- `src/agent.ts`: adapter selection, configuration state and explicit mock/live boundaries.
- `src/model-agent.ts`: real model planning, checking and interpretation adapted into UI events; explicit demo Discord receipts.
- `server/model.mjs`: server-only credentials, personnel/calendar feasibility filtering, real inference and output validation.
- `server/start.mjs`: loopback-only production server serving dist and the same model routes.
- `server/model.test.mjs`: feasibility, validation, error-content and local-origin checks.
- `scripts/test_model_flow.mjs`: opt-in live integration test against the local service.
- `src/data.ts`: project fixture and imported company input; `src/company-data.json` is a compact, checksum-derived frontend projection.
- `data/company/`: ten original company JSON files, import manifest and provenance; 1,000 employee records, dated capacity, calendars and bookings for future model integration.
- `scripts/import_company.py`: validates source checksums, unique IDs, department counts and dated capacity, then regenerates imports; never executes package scripts.
- `src/data.test.ts`: import fidelity, capacity, counts and source-hash regression checks.
- `vite.config.ts`: React integration and a separately cached company-data chunk.
- `src/style.css`: responsive dashboard layout, reduced-motion support and system fonts.
- `src/theme.css`: white backgrounds, dark text, cyan actions and accessible light-theme state colors.
- `src/state.test.ts`: meaningful state and persistence regression tests.
- `README.md`: startup, walkthrough and local integration contract.

## Workflow

`npm ci` → configure ignored `.env.local` → `npm run dev` for local preview with inference middleware. `npm run build` then `npm start` runs the built app locally. `npm test` checks state behavior; `npm run build` validates TypeScript and creates static `dist/` assets. Four small local model routes use the same service in development and production. No separate backend deployment or browser credential.

## Module Inputs And Outputs

Project + company inputs → AgentAdapter → typed runtime events → state reducer → dashboard. Users can select real model mode or explicit development mock. Discord is labeled simulated independently of the model mode. The configured model uses Basic-authenticated chat completions; a real Discord runtime may still provide subscribe callbacks. Model credentials never enter events or frontend bundles.

Local storage persists the snapshot and selected adapter mode. Interrupted operations require reset. Abort, run IDs and stable event IDs prevent late results or duplicate operations from advancing a new run.

## Data Stats Change

Company input replaced by Anne’s provided Bridgewell Creative dataset, ID bridgewell-us-agency-1000-en-v2. 1,000 employees, 17 departments, 72 role types, 99 teams, 14,000 calendars, 14,000 capacity rows, 30,625 bookings. Original JSON files are preserved with SHA-256 verification. Skills, permissions and reference-day (2026-10-26) free hours are projected for the frontend; full data remains local. Development assignments now reference EMP-0349 / Taylor Reed, EMP-0329 / Alex Morgan and EMP-0218 / Jordan Brooks. Source provenance remains synthetic; imported six-step / reassignment workflows are not adopted. Project brief and model details remain pending.

## Feature Specs

- Start Project → planning → tasks / assigned owners / deadlines.
- Skip to execution → inject development issue → notification → wait for worker decision → update commitment and next checkpoint.
- Model-mode assignments, anomaly classification and reply interpretation are genuine inference. No fallback to mock on error. Discord notifications/replies remain labeled DEMO until real transport is connected.
- Monitoring triggers a genuine initial check and 30-second checks. No-evidence responses return to monitoring; unresolved replies remain awaiting; no reassignment is performed.
- No reassignment or final delivery / acceptance workflow in P0.
- CoFloor service name in the page title, navigation, Agent messages, footer and npm metadata. New runtime integrations use `window.cofloorAgent`; the legacy alias and storage namespace remain compatible. Logo candidates await Anne’s review; the header currently uses a text wordmark.
- White background with cyan actions; factual text only. Removed promotional subtitles and file explanation labels.
- Google Doc updated in original Requirements / Technical Requirements / Frontend prompt structure; preceding draft retained in full as final appendix.

## Validation

Thirteen offline tests pass (data import, state and server-model validation): stale / duplicate event protection; reply gating and owner preservation; persistence and interrupted-run recovery. Strict TypeScript / production build pass. Browser walkthrough verified start, assignments, stage skip, issue notification, waiting through refresh, worker reply, resumed state, reset and unavailable local runtime errors. Desktop visual inspection confirms no promotional subtitles and a visible primary action.

CoFloor rename validation: all six existing tests and strict TypeScript / production build pass. Browser inspection confirms the CoFloor page title, navigation and footer. Adapter checks confirm development mode, explicit missing-runtime errors, the legacy alias and CoFloor adapter precedence.

## Maintenance Log

- 2026-10-25: Implemented local dashboard and adapter boundary; synchronized Google Doc with original structure and appended prior draft. Real local model and Discord integration remain pending.

- 2026-10-25: Imported provided company records, capacities and local schedules. UI counts derive from the dataset; date labels use its reference time. Dataset-specific storage prevents stale invented employee IDs. No UI redesign or new workflow.

- 2026-10-25: Changed current dashboard to white backgrounds at Anne’s request. No historical white UI exists in the available Git commits; layout, employee inputs and Agent integration boundaries are preserved.

- 2026-10-25: Renamed the service and npm package to CoFloor, added a repository landing README, and retained existing runtime integrations and saved sessions. Historical source directory remains `qubemc-demo/`. Logo review is separate from this rename.

- 2026-10-25: Connected the supplied deployed model through a server-only adapter. Verified provider test and real planning; added local route validation and honest Discord demo labels. Credential stored only in ignored owner-readable .env.local. Browser automation was blocked by URL security policy; actual service integration is tested directly.

- Live service verification: provider test returned 4; actual planning returned eligible IDs; no-evidence check stayed clear; injected photography delay produced a visual-task risk and question; a blocked reply stayed unresolved; an explicit 3 PM commitment was accepted with its supplied 2:30 PM checkpoint. A direct-answer request was also verified (0.87 s for a minimal JSON result).

- Concurrent-work limitation: the new Red Bull board is being authored separately in this checkout. This model change does not stage or overwrite its files. Automatic approval review rejected a test that would send that separate project document, so document-backed model requests are blocked pending explicit user authorization. Three-workstream API tests remain independent.

- Final direct-answer live verification: planning 1.4 s, evidence-free check 0.5 s, injected-risk check 1.9 s, unresolved reply 0.6 s, accepted commitment 0.7 s. JSON-constrained output validated; model-generated decision question is a valid draft if no separate message is returned.
