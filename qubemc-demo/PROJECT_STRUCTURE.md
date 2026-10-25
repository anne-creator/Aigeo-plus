# CoFloor Project Structure

## Expanded launch asset brief (2026-10-25)

This section supersedes earlier descriptions of the source document as a single-post or fixed eight-node brief. The current brief requests one fictional X launch package: messaging/direction, teaser/launch/follow-up copy, three template-based visuals and editable sources, image-specific alt text, FAQ/reply drafts and a manifest-based handoff. Each category has inputs and acceptance criteria; dependency and timing guidance retains the 4 p.m. deadline and 1–3 p.m. primary-image window. The Alex scenario describes explicit manager confirmation of a versioned proposal, with no predetermined replacement.

- `data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md` is the shared source: frontend raw import and server filesystem read resolve to this same file. The server reads it at module initialization, so restart/reload the backend before a future allocation; persisted runs remain unchanged.
- `src/redbull-project.ts` synchronizes the summary, supplied inputs and deliverable list; the launch card describes the expanded package. Company data and identifiers are unchanged.
- Desired decomposition is 8–20 meaningful tasks, preferably around 12, chosen by the model. No task cards or execution owners are hardcoded by the brief. Runtime limits remain unchanged (server 2–12, frontend maximum 12); the existing planner prompts may still return fewer tasks. Supporting 13–20 tasks and verifying model quality remain follow-up work in `NEXT_STEPS.md`.
- This update changes content only: no recommendation panel, demo-progress controls, automatic transitions, additional approvals, model calls, Discord delivery or deployment. Existing concurrent narration/transport work is outside this change.
- Validation: five existing board-state tests, the document/adapter contract check and TypeScript/production build passed. An intercepted server planner call confirmed its document payload exactly matches the same Markdown source; the stub stopped before inference or persistence. Real model decomposition and scheduling remain unverified.


## Project voice narration (2026-10-25)

- **Workflow:** Start project initializes browser audio; persisted allocation, received Alex leave, validated proposal and verified delivery events form an ordered narration timeline. Authenticated confirmation and successful reassignment emit confirmation then recovery. Test confirmations retain explicit test wording. A proposal never changes owners or claims that work resumed.
- **Server inputs/outputs:** `server/narration.mjs` maps validated staff/task/schedule data to English templates and stable run-scoped event IDs. The coordinator persists optional `narrationEvents` and version-bound `confirmation` alongside state. The Discord adapter supplies trusted receipt metadata separately from public input, requires a direct reply to the current proposal, and requires a delivery message ID before narrating successful delivery. Existing runs need no migration; missing narration fields mean no historical announcements.
- **Speech boundary:** `server/speech.mjs` adds same-origin `POST /api/speech` (`{text}` → WAV) to Vite and the production Node server. It uses only the pinned private Qwen endpoint, Ryan, `tts-1`, a 180-second timeout, 8000-character text limit and 20 MiB audio limit; upstream errors are sanitized. There is no cloud/browser-synthesized voice fallback.
- **Browser:** `src/narration.ts` owns sequential synthesis/playback, deduplication, baseline hydration, stale-event rejection, version-aware wording and cancellation. `src/VoiceNarration.tsx` and `src/voice.css` provide an independent voice toggle, transcript, activation and retry controls. Reset aborts old requests/audio; mute drops the queue but continues text; refresh/shared links do not replay history. Audio failure never advances or blocks project state.
- **Data/stat changes:** No company inputs, staffing rules or business dates changed. New optional audit fields are saved only in ignored run files. Voice mute preference is local to the browser. No new package dependencies or inference-provider credentials.
- **Validation:** All 76 offline tests, board contract and TypeScript/production build passed. Added coverage for skipped/duplicate/reordered snapshots, queue cancellation, stale plans, retrospective wording, autoplay restriction, retry, speech request validation/timeouts, manager identity, current-proposal receipts, failed application and atomic confirmation persistence. Browser fixture used silent WAV audio and no real model/Discord calls; desktop playback, failure/retry, activation, mute updates and silent refresh passed. The 390px initial voice layout was inspected; the later mobile resumed-state check was interrupted by local browser navigation failure.
- **Runtime limit:** The real Spark Qwen smoke request timed out connecting to `100.89.121.112:8004`; no WAV was produced, so actual voice quality and generation latency are not certified. Live Alex/manager replies and deployment remain follow-up validation. No online publication or live Discord message was performed.


The Dashboard panel starts collapsed on every page load. Click the header Dashboard button or navigation to open it; expanded state is not restored after refresh.

Background wheel shortcut (`src/dashboard-gesture.ts`): standard trackpad/mouse wheel events drive the same `dashboardOpen` state. Positive vertical delta shows the panel and negative hides it after 60 normalized pixels (16px/line, viewport height/page); physical swipe direction follows system scrolling settings. One command per burst, rearmed after 250ms idle. Dashboard, board, header/navigation, settings, interactive controls and open dialogs retain native scrolling; horizontal/modified/pinch bursts cannot trigger or leak into the background. The app-shell effect removes its listener and idle timer on unmount. No backend or mobile touch gesture changes. `src/dashboard-gesture.test.ts` covers thresholds, units, direction, jitter, inertia, exclusions, idle reset and cleanup.

Gesture validation: 9 focused tests plus the full 45-test suite and production build passed. Chrome and Safari background show/hide were checked with native wheel input. In-app browser checks also verified repeated directions, transparent dashboard top padding, horizontal board scrolling, native document-drawer scrolling and modal/settings exclusions. Edge is unavailable on this machine, so an Edge-specific browser run remains unverified.

Startup is click-gated: opening or refreshing the Dashboard begins idle and does not restore/start an active run or inject facts. Only **Start project** initiates allocation. Once clicked, allocation starts; sick leave waits for an explicit Alex group event. There is no automatic leave timer. Explicit **Reset project** still starts a new allocation. Saved server runs remain audit history. This supersedes earlier auto-resume-on-refresh notes.

Task cards, dependencies, details, activity and model messages display task text and employee names. Internal IDs remain in state/API/audit data; presentation resolves saved model text too. The original Markdown download remains unchanged.

## Work-focused dashboard and allocation animation (2026-10-25)

This section supersedes earlier summary-card and persistent-expansion presentation notes.

- `src/main.tsx` + `src/dashboard-focus.css`: the global view has one launch card (deliverables, deadline, Brief and Start project), with small company totals. No empty task board or progress ring. The project view has a compact project/owner/deadline/completion bar, a roughly 75/25 task-board/sidebar split, unresolved issues and five latest changes. Cards prioritize task title, owner, status and deadline. At narrow widths the order is attention → horizontally scrollable board → changes. Existing details, Team, Brief, Activity and server operations remain available.
- `src/dashboard-presentation.ts`: pure presentation stages (global, assigning, setup-error, entering, project), current-run reveal guard, and adjacent valid snapshot observations. First allocation produces one team-ready summary; repeated/reordered snapshots do not duplicate entries. Owner/status/blocker/schedule changes get sync-observation labels rather than invented event times. All changed task cards can highlight for five seconds even though the feed is capped at five. Proposals remain pending until applied; unresolved decisions have an explicit sidebar entry and never open a dialog automatically. Reset clears observations.
- `src/AllocationAnimation.tsx` + `public/allocation/scan-drop.mp4`: Anne's unchanged 12-second silent video from `CoFloor-Scan-Drop-Standalone/CoFloor-Scan-Drop-Silent.mp4`. Original titles, names, captions and timing are preserved at Anne's request; this is a standalone visual loop, not a live data display. The video uses muted autoplay/loop/playsInline and is only mounted during assignment. Existing office art covers loading, media failure, playback rejection, pause, reduced motion and hidden-page states. The media cannot signal business success. No extra runtime, audio, CDN or backend progress endpoint.
- Start project immediately hides the panel and shows the dedicated allocation screen. A validated active snapshot exits it and starts the existing F90 arrival; `ProjectScene` reports completion using the run ID, and the parent reveals the project panel once. An explicit entry-run token covers instant results that batch away the planning render. Pause/reduced-motion/canvas failure skip entry safely. Older requests and callbacks cannot reveal another run, and refresh never reopens a manually collapsed panel. Assignment/error/arrival stages disable ordinary dashboard buttons and wheel gestures. Failure retains the allocation screen with Retry.
- APIs, company input files, task statuses, reservations, assignment validation and Discord transport are unchanged. No timer moves tasks or fabricates percentages. Refresh continues through existing state/check endpoints, including retry of a received event's failed analysis.
- Validation: presentation tests cover phases, stale callbacks, once-only reveal, pending/applied proposals, duplicate/reordered snapshots, complete highlight sets and run reset; existing arrival tests cover completion, reset, pause and reduced motion. Browser checks use an explicitly labeled local adapter fixture (no model/Discord calls) for slow/instant success, failure/retry, transition ordering, pending review, owner/blocker changes, manual collapse, pause and 390px layout. The supplied video is verified byte-for-byte against the original. See the current maintenance entry for final check results.

## Project-driven building and office scenes (2026-10-25)

- `src/scene/arrival.ts` preserves the supplied tower’s F90 zoom (3.5×, cubic-bezier(.7,0,.2,1), 760 ms switch). A successful planning → active allocation triggers it once before revealing the office. Snapshots during entry update the queued employee scene; actors start walking after arrival. Reset cancels the old transition. Paused/reduced-motion/hidden scenes skip or finish entry, and reloads do not replay it. The camera origin follows the fitted tower on desktop and mobile; dashboard controls remain fixed. Lifecycle and camera regression tests cover these gates.
- `src/scene/ProjectScene.tsx` switches from headquarters to the project office only after a successful active allocation with tasks. Planning, setup errors and idle states retain the building. A run reset clears all actor/animation deduplication state. Hiding the dashboard reveals the full scene without changing the project.
- `src/scene/art.mjs` and `assets/office.jpg` adapt the user-supplied `cofloor-deploy` tower painter and pixel sprite artwork. `model.ts` and `engine.ts` adapt the corridor pathfinding and actor movement from its `motion.js`. The standalone wrapper, fixed thirteen-event replay, fixed reference assignments and simulated approvals are excluded. No package installation or remote media dependency.
- Validated live snapshots provide actual employee IDs, names, task skills/statuses, manager ID, leave records and assignment versions. Allocation routes employees through brief handoff to functional desks; sick leave sends the affected owner to the exit and alerts the PM; a versioned replacement receives the handoff; a real done transition can carry output to a dependent task's owner. Identical snapshots do not replay assignments. Refresh does not invent past completed handoffs. Positions are illustrative, not physical tracking or attendance.
- Unknown skills/IDs, runtime errors or manual **Settings → Ambient animation** use decorative corridor walking without delivery packets or implied task completion. Missing office art uses a procedural floor with walking sprites; unavailable/lost canvas uses CSS walking figures over the night skyline. Fallback is labeled **Ambient motion**. Scene code never calls the model, books staff, mutates tasks, approves work or publishes anything.
- The header pause control, reduced-motion changes, page visibility and component cleanup control the animation loop. Drawing is throttled to 24 fps. Office avatars open the existing owner's task detail (or team view for the PM). The original glass styling and real workflow controls remain in place.
- Validation: scene tests cover stage gates, real-ID assignment, duplicate snapshots, sick leave, replacement, actual dependency completion, new-run/refresh behavior, fallback and corridor connectivity. Production build plus existing regression suite; browser validation covers building, live setup, office, pause, dashboard collapse and manual ambient mode.


## Live two-moment workflow (2026-10-25)

This section supersedes the earlier reference-intake and approval-workflow notes.

- `server/project.mjs`: canonical document input, live production-task decomposition and assignment, project manager selection, feasibility validation, durable per-run state, deduplicated Alex group events, validated reassignment proposals and version-bound manager confirmation, reservation release/rebooking and assignment/handoff history. Working copies stay in ignored `.cofloor-runs/`. All source company files remain unchanged.
- `server/model.mjs`: existing model connection plus run-scoped plan/check/decision/state routing. Preloaded Red Bull setup is explicitly supported; no blanket document authorization rejection. Credentials remain server-only and the configured HTTPS host allowlist remains enforced.
- `src/redbull-agent.ts`, `src/board-state.ts` and the current dashboard: built-in live HTTP adapter, validated snapshots, v3 live storage, automatic In project entry, timer recovery, manager dialogue and immediate reallocation on Reset. Board status attention replaces the old review gate.

`Start project` → live production allocation (Alex owns the launch image) → In project, waiting for Alex → normalized group event → persist sick leave/release affected reservations → live model creates a validated proposal → pending outbound group message mentioning PM → PM confirms that proposal version → revalidate/apply all updates atomically. No timer generates leave, no replacement starts before confirmation, and unaffected tasks continue. Other-project bookings remain availability constraints only.

Group event input uses the local `/api/model/event` adapter boundary; real Discord transport/authenticated identity mapping remain deferred. `BoardRun` now includes logical channel, event status and versioned proposal. `decision` requires manager identity, channel and proposal version. UI renders the shared conversation, reassignment list and local test reply, with manual state refresh for external events. The server tags runs `discord-confirm-v1` and rejects old timed workflows; source company files and original Markdown remain unchanged.

The source document's original reference ranking, named actors and eight-node approval flow are retained as source data, not UI requirements. The dynamic plan does not return rankings or evidence; original brief/inputs and outputs survive handoff. Real Discord is outside this change: delivery and manager input are explicitly labeled simulated/test.

Validation: server/state regression tests, canonical-document and adapter contract check, strict TypeScript/build, desktop/mobile browser test with mocked transport, and opt-in genuine-model integration script. Current regression cases cover indefinite waiting without a timer, Alex identity/channel validation, durable event deduplication, pending proposals, stale/unauthorized confirmations, changed availability, preserved inputs and run isolation. These updated tests and live integration scripts were not run for this change, as requested.

---

## Earlier presentation: collapsible glass dashboard (2026-10-25)

- Night skyline background: `src/NightCity.tsx` renders deterministic SVG towers, blue roof lights, layered skyline, window lights and a drifting light band behind the panels. CSS animates opacity and transforms without timers or network media. The header pause/play control stops the scene; reduced-motion preferences disable animation. Night-scene contrast uses 45% scene brightness and 70% saturation; glass has 5% white tint / 48 px blur and slightly desaturated backdrops, with a lighter shadow and fine edge highlight for clearer transmission. Titles and key numbers use weight 600, with weight 500 labels. This brings the dark neutral glass and bright text closer to the supplied Wealth reference while retaining transmitted blue light. Production build and browser pause/play checks pass.

- Transparency correction: all five dashboard panels share a 10.7% white tint with 30 px backdrop blur; removed the 83–90% opaque dark fills and adjusted text for the white stage. Panel backgrounds transmit the scene beneath them; text and controls stay fully opaque. No project logic changes.

- `src/main.tsx` and `src/kanban.css`: Wealth-inspired rounded glass cards, circular navigation and a bottom-anchored dashboard over an animated blue night skyline. The scene uses local SVG/CSS and has no external image or walking characters. Retains the React project and its existing runtime; the supplied HTML brief is a visual reference, not a replacement finance application.
- Tasks, Team, Schedule, Progress and the four-column task board share one lower panel. Metrics derive from the existing board/company/project inputs; there are no invented financial figures or fake progress. Dashboard descriptions, explanatory empty states and promotional copy are removed. Task requirements and the unchanged original brief remain accessible in dialogs.
- The header Dashboard button hides or expands the whole lower panel. `cofloor-dashboard:expanded` stores only that presentation preference; hiding never resets tasks or aborts a live subscription. The left rail and mobile bottom dock retain access to the dashboard, board, team, document, activity and settings. Team and activity use focus-contained dialogs. The board scrolls internally to preserve the lower-panel height when several cards occupy one column.
- Desktop targets the supplied 1341 × 958 proportions with CSS `--u`; smaller screens use a multi-column layout and then a single scrolling column. Reduced motion is respected.
- Project state transitions, dependency gates, reference assignments, data, adapter selection, server routes and credentials are unchanged. Read-only local status returned `configured: true`, model `coo-llm`, Discord `demo`. The existing local model service still rejects document-backed intake and uses the older three-workstream contract; this UI change does not claim the Red Bull board is connected to live inference.
- Validation: strict TypeScript and production build; 7 board tests, the board contract check and 13 existing data/state/model tests pass. Browser checks cover reference start, task detail, hide/show, hidden preference through refresh, desktop and 390 px mobile layouts. No live project document was submitted. Work stays local; no commit or push per Anne's instruction.


## Earlier feature: Red Bull document and Kanban board (2026-10-25)

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

- 2026-10-25: Implemented work-focused global/project dashboards, separate allocation and arrival stages, snapshot-based latest changes and inline attention. Integrated Anne’s original silent scan/drop animation unchanged; no push or live model/Discord verification.
- Final validation for the dashboard update: all 52 offline tests, the board contract check and strict TypeScript/production build passed. Local browser fixtures verified a 45-second wait with repeated 12-second video loops, pause/static fallback, hidden allocation/entry panels, failure/retry, instant success, pending proposals without automatic dialogs, changed-card highlight and 390px panel order/internal board scrolling. No live allocation or Discord request was used.

## Remote integration merge (2026-10-25)

Merged the Spark/NemoClaw Discord deployment and project-announcement updates from origin/main with the work-focused dashboard. Preserved authenticated Discord event handling, manager confirmation in Discord, delivery status, configured origin checks and server deployment helpers. The project toolbar retains a Project group entry; pending issues still require a click rather than opening a dialog automatically.

A plain URL still starts with the Dashboard hidden. An explicit `?run=` link restores that server run, shows a loading/error screen until valid tasks arrive, and opens the project once. Retry on a shared-run loading failure fetches that run instead of launching another allocation. Empty hydration snapshots create no team-ready events. Successful runs retain the remote shareable URL behavior and five-second state refresh; repeated snapshots neither duplicate changes nor reopen a manually hidden Dashboard. These shared-run and transport behaviors supersede the earlier click-only/manual-refresh notes above.

Validation after merge: 60 offline tests, the board adapter contract check and the production build pass. Added shared-run hydration/error coverage and retained both dashboard-presentation and deployment test suites. No live Discord message or real allocation was triggered during merge verification.
