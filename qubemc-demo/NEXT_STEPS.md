# Next steps

## Expanded Red Bull brief — implemented locally, October 25, 2026

Anne approved enriching the project brief first, with no additional workflow features. The current source brief now describes a small X launch asset package: messaging and creative direction; teaser, launch and follow-up posts; matching visuals and editable sources; final-image alt text; FAQ and comment-reply drafts; and a packaged handoff with versions and link mapping.

The AI still determines task grouping and owners. The desired planning range is **8–20 meaningful tasks, preferably around 12**. This is guidance in the brief, not a fixed task list or a new enforced task-count rule.

Completed in this update:

- Replaced the old two-production-task / fixed approval-sequence brief with deliverable requirements, inputs, acceptance criteria and necessary dependencies.
- Kept one fictional project, the existing company dataset, October 26 business date, 4 p.m. package deadline and 1–3 p.m. primary-image window.
- Aligned Alex's leave scenario with current versioned project-manager confirmation; no predetermined replacement or automatic leave event.
- Updated project metadata, deliverables and the launch-card introduction to describe the expanded package.

## Follow-up: model decomposition and task limits

These items require a separate implementation pass:

1. Run a deliberate live-model trial against the enriched brief to inspect task count, distinct deliverables, actual dependencies and staff/schedule feasibility. A brief update alone does not guarantee at least eight tasks.
2. Review the planner and repair prompts against the expanded scope. They currently favor limited production windows and discourage supporting tasks; this update does not change them.
3. If enforcing the 8–20 range, update the server planning validator, repair behavior and frontend snapshot validator together. The current server accepts 2–12 tasks and the frontend also caps tasks at 12; a 13–20-task result cannot currently be accepted. Prefer approximately 12 tasks instead of filling the upper bound.
4. Validate retries, unavailable staff and duplicate/filler-task handling before claiming the target range is reliable. Preserve the existing approval and reservation safeguards.

## Not included in the current request

The earlier proposal for a recommendations panel, manual Demo start/completion controls, automatic status transitions and further workflow improvements is not authorized by the current brief-only scope. Do not implement it as part of the task-count follow-up without a new request.

No live inference, Discord messages, deployment or task-count validation changes were performed in this brief update. Existing saved runs are not regenerated; a later new allocation reads the updated brief after the backend is restarted/reloaded.

Validation: five existing board-state tests, the document/adapter contract check and the TypeScript/production build passed. An intercepted planner call confirmed that the backend receives the same source document; it performed no inference and saved no run.
