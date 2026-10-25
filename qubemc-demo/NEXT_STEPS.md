# Next steps

## Current scope: original small-task demo restored

On October 25, 2026, Anne requested withdrawing the expanded launch package after reporting timeouts and returning to the earlier 3–4-task-style demo. The original single-X-post brief, project metadata and launch-card description are restored. AI still determines the compact breakdown; an exact count of three or four is not newly enforced.

The three-post package, added visual adaptations, FAQ/reply assets and 8–20-task guidance are withdrawn. Do not reintroduce them or raise task-count limits without a new request. The previous proposals for recommendations and demo-progress controls also remain outside the current scope.

## Operational follow-up

- Restart/reload the backend before creating a new allocation: the coordinator reads the brief at module initialization. A shared/saved run retains its old task list.
- Check the actual connected model's response time and generated tasks before claiming timeout recovery. This rollback does not run live inference or alter model connectivity, timeouts or scheduler rules.
- Keep current voice, face-recognition, dashboard and versioned manager-confirmation behavior.

## Validation

Five board-state tests, the document/adapter contract check and the TypeScript/production build passed. The restored source brief and project metadata match their pre-expansion versions byte-for-byte. No live inference, Discord messages or deployment are included in this rollback.
