# Project Structure

## Project Structure

Single local React + TypeScript + Vite frontend. Future backend / local model integration belongs in this same project.

- `src/main.tsx`: factual English dashboard, two presentation moments, secondary development controls.
- `src/state.ts`: shared input / event types, state transitions, persistence recovery and event deduplication.
- `src/agent.ts`: replaceable AgentAdapter, development fixtures, explicit unavailable-live handling.
- `src/data.ts`: preloaded project input and 1,000 synthetic employees across 17 departments.
- `src/style.css`: responsive dark / cyan presentation UI, reduced-motion support, system fonts.
- `src/state.test.ts`: meaningful state and persistence regression tests.
- `README.md`: startup, walkthrough and local integration contract.

## Workflow

`npm ci` → `npm run dev` for local preview. `npm test` checks state behavior; `npm run build` validates TypeScript and creates static `dist/` assets. No API service, remote runtime assets or hosted deployment.

## Module Inputs And Outputs

Project + company inputs → AgentAdapter → typed runtime events → state reducer → dashboard. The current adapter is explicitly development mock. Future local inference / Discord runtime can provide start/check async iterables and subscribe to real inbound events without changing UI components. No transport protocol is assumed.

Local storage persists the snapshot and selected adapter mode. Interrupted operations require reset. Abort, run IDs and stable event IDs prevent late results or duplicate operations from advancing a new run.

## Data Stats Change

One preloaded launch brief, three assets, 17 department names and 1,000 deterministic synthetic employee records. Three example assignments are fixture data only. Actual input, team rules and model details remain pending.

## Feature Specs

- Start Project → planning → tasks / assigned owners / deadlines.
- Skip to execution → inject development issue → notification → wait for worker decision → update commitment and next checkpoint.
- All development events marked mock; live mode never silently falls back to fixtures.
- No reassignment or final delivery / acceptance workflow in P0.
- Original dark / cyan direction; factual text only. Removed promotional subtitles and file explanation labels.
- Google Doc updated in original Requirements / Technical Requirements / Frontend prompt structure; preceding draft retained in full as final appendix.

## Validation

Three state tests pass: stale / duplicate event protection; reply gating and owner preservation; persistence and interrupted-run recovery. Strict TypeScript / production build pass. Browser walkthrough verified start, assignments, stage skip, issue notification, waiting through refresh, worker reply, resumed state, reset and unavailable local runtime errors. Desktop visual inspection confirms no promotional subtitles and a visible primary action.

## Maintenance Log

- 2026-10-25: Implemented local dashboard and adapter boundary; synchronized Google Doc with original structure and appended prior draft. Real local model and Discord integration remain pending.
