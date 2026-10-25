# CoFloor Project Structure

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
