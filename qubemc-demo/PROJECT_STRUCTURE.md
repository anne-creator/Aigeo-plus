# CoFloor Project Structure

## Project Structure

Single local React + TypeScript + Vite frontend. Future backend / local model integration belongs in this same project.

- `src/main.tsx`: factual English dashboard, two presentation moments, secondary development controls.
- `src/state.ts`: shared input / event types, state transitions, persistence recovery and event deduplication.
- `src/agent.ts`: replaceable AgentAdapter, development fixtures, explicit unavailable-live handling.
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

`npm ci` → `npm run dev` for local preview. `npm test` checks state behavior; `npm run build` validates TypeScript and creates static `dist/` assets. No API service, remote runtime assets or hosted deployment.

## Module Inputs And Outputs

Project + company inputs → AgentAdapter → typed runtime events → state reducer → dashboard. The current adapter is explicitly development mock. Future local inference / Discord runtime can provide start/check async iterables and subscribe to real inbound events without changing UI components. No transport protocol is assumed.

Local storage persists the snapshot and selected adapter mode. Interrupted operations require reset. Abort, run IDs and stable event IDs prevent late results or duplicate operations from advancing a new run.

## Data Stats Change

Company input replaced by Anne’s provided Bridgewell Creative dataset, ID bridgewell-us-agency-1000-en-v2. 1,000 employees, 17 departments, 72 role types, 99 teams, 14,000 calendars, 14,000 capacity rows, 30,625 bookings. Original JSON files are preserved with SHA-256 verification. Skills, permissions and reference-day (2026-10-26) free hours are projected for the frontend; full data remains local. Development assignments now reference EMP-0349 / Taylor Reed, EMP-0329 / Alex Morgan and EMP-0218 / Jordan Brooks. Source provenance remains synthetic; imported six-step / reassignment workflows are not adopted. Project brief and model details remain pending.

## Feature Specs

- Start Project → planning → tasks / assigned owners / deadlines.
- Skip to execution → inject development issue → notification → wait for worker decision → update commitment and next checkpoint.
- All development events marked mock; live mode never silently falls back to fixtures.
- No reassignment or final delivery / acceptance workflow in P0.
- CoFloor service name in the page title, navigation, Agent messages, footer and npm metadata. New runtime integrations use `window.cofloorAgent`; the legacy alias and storage namespace remain compatible. Logo candidates await Anne’s review; the header currently uses a text wordmark.
- White background with cyan actions; factual text only. Removed promotional subtitles and file explanation labels.
- Google Doc updated in original Requirements / Technical Requirements / Frontend prompt structure; preceding draft retained in full as final appendix.

## Validation

Six tests pass (three data import checks plus three state tests): stale / duplicate event protection; reply gating and owner preservation; persistence and interrupted-run recovery. Strict TypeScript / production build pass. Browser walkthrough verified start, assignments, stage skip, issue notification, waiting through refresh, worker reply, resumed state, reset and unavailable local runtime errors. Desktop visual inspection confirms no promotional subtitles and a visible primary action.

CoFloor rename validation: all six existing tests and strict TypeScript / production build pass. Browser inspection confirms the CoFloor page title, navigation and footer. Adapter checks confirm development mode, explicit missing-runtime errors, the legacy alias and CoFloor adapter precedence.

## Maintenance Log

- 2026-10-25: Implemented local dashboard and adapter boundary; synchronized Google Doc with original structure and appended prior draft. Real local model and Discord integration remain pending.

- 2026-10-25: Imported provided company records, capacities and local schedules. UI counts derive from the dataset; date labels use its reference time. Dataset-specific storage prevents stale invented employee IDs. No UI redesign or new workflow.

- 2026-10-25: Changed current dashboard to white backgrounds at Anne’s request. No historical white UI exists in the available Git commits; layout, employee inputs and Agent integration boundaries are preserved.

- 2026-10-25: Renamed the service and npm package to CoFloor, added a repository landing README, and retained existing runtime integrations and saved sessions. Historical source directory remains `qubemc-demo/`. Logo review is separate from this rename.
