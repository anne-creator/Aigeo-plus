# Project Structure

Last updated: 2026-10-25 18:26:46 UTC

## Project Structure

- root files: 16 files
- `deploy/`: 8 files
- `docs/`: 3 files
- `prisma/`: 2 files
- `public/`: 5 files
- `scripts/`: 3 files
- `src/`: 146 files

### File Tree

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `.vercelignore`
- `AGENTS.md`
- `Dockerfile`
- `README.md`
- `eslint.config.mjs`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `tsconfig.json`
- `vercel.json`
- `vitest.config.mts`
- `打包说明.txt`
- `deploy/Caddyfile`
- `deploy/README.md`
- `deploy/bootstrap-admin.mjs`
- `deploy/bootstrap-admin.test.mjs`
- `deploy/compose.yaml`
- `deploy/production.env.example`
- `deploy/start.mjs`
- `deploy/vercel-build.mjs`
- `docs/原始需求.md`
- `docs/开发约定.md`
- `docs/考核规则说明.md`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `scripts/capture-guide-shots.mjs`
- `scripts/prisma-generate.mjs`
- `scripts/sanitize-standalone.mjs`
- `src/app/favicon.ico`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/admin/_components.tsx`
- `src/app/admin/_lib.ts`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/interns/actions.ts`
- `src/app/admin/interns/page.tsx`
- `src/app/admin/pay/actions.ts`
- `src/app/admin/pay/page.tsx`
- `src/app/admin/pay/receipt-forms.tsx`
- `src/app/admin/pay/[pmId]/page.tsx`
- `src/app/admin/projects/actions.ts`
- `src/app/admin/projects/page.tsx`
- `src/app/admin/projects/[id]/page.tsx`
- `src/app/admin/projects/[id]/timeline-actions.ts`
- `src/app/admin/projects/[id]/timeline/page.tsx`
- `src/app/admin/projects/new/page.tsx`
- `src/app/admin/reviews/page.tsx`
- `src/app/admin/reviews/timeline-actions.ts`
- `src/app/admin/reviews/timeline-revisions.tsx`
- `src/app/admin/settings/actions.ts`
- `src/app/admin/settings/ai-connection.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/users/actions.ts`
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/role-fields.tsx`
- `src/app/api/deliverables/[id]/submit/route.ts`
- `src/app/api/files/[submissionId]/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/projects/[id]/client-html/route.ts`
- `src/app/api/task-files/[kind]/[id]/route.ts`
- `src/app/api/uploads/prepare/route.ts`
- `src/app/api/uploads/token/route.ts`
- `src/app/channel/layout.tsx`
- `src/app/channel/page.tsx`
- `src/app/channel/[projectId]/page.tsx`
- `src/app/intern/_components.tsx`
- `src/app/intern/actions.ts`
- `src/app/intern/layout.tsx`
- `src/app/intern/page.tsx`
- `src/app/intern/knowledge/page.tsx`
- `src/app/intern/work/page.tsx`
- `src/app/login/actions.ts`
- `src/app/login/page.tsx`
- `src/app/meetings/actions.ts`
- `src/app/meetings/layout.tsx`
- `src/app/meetings/page.tsx`
- `src/app/meetings/new/page.tsx`
- `src/app/meetings/new/participant-picker.tsx`
- `src/app/partner/page.tsx`
- `src/app/pm/_components.tsx`
- `src/app/pm/_lib.ts`
- `src/app/pm/_timeline-visual.tsx`
- `src/app/pm/layout.tsx`
- `src/app/pm/page.tsx`
- `src/app/pm/pay/page.tsx`
- `src/app/pm/projects/actions.ts`
- `src/app/pm/projects/page.tsx`
- `src/app/pm/projects/[id]/page.tsx`
- `src/app/pm/projects/[id]/share-actions.ts`
- `src/app/pm/projects/[id]/deliverables/[deliverableId]/page.tsx`
- `src/app/pm/projects/[id]/edit/basics-form.tsx`
- `src/app/pm/projects/[id]/edit/page.tsx`
- `src/app/pm/projects/[id]/timeline/actions.ts`
- `src/app/pm/projects/[id]/timeline/confirm-button.tsx`
- `src/app/pm/projects/[id]/timeline/page.tsx`
- `src/app/pm/projects/[id]/timeline/rows-editor.tsx`
- `src/app/pm/projects/new/kpi-row.tsx`
- `src/app/pm/projects/new/page.tsx`
- `src/app/pm/projects/new/project-form.tsx`
- `src/app/pm/tasks/_components.tsx`
- `src/app/pm/tasks/_lib.ts`
- `src/app/pm/tasks/actions.ts`
- `src/app/pm/tasks/page.tsx`
- `src/app/pm/tasks/[batchId]/draft-editor.tsx`
- `src/app/pm/tasks/[batchId]/page.tsx`
- `src/app/share/[token]/page.tsx`
- `src/app/share/[token]/file/[submissionId]/route.ts`
- `src/components/app-shell.tsx`
- `src/components/minutes-slider.tsx`
- `src/components/pay-view.tsx`
- `src/components/timeline-diff.tsx`
- `src/components/ui.tsx`
- `src/components/upload-form.tsx`
- `src/components/calendar/actions.ts`
- `src/components/calendar/calendar-sidebar.tsx`
- `src/components/calendar/checklist.tsx`
- `src/components/calendar/utils.ts`
- `src/components/client-view/project-view.tsx`
- `src/components/client-view/share-card.tsx`
- `src/components/client-view/static-markup.ts`
- `src/components/client-view/styles.ts`
- `src/lib/ai-config.ts`
- `src/lib/ai-review.ts`
- `src/lib/auth.ts`
- `src/lib/calendar.ts`
- `src/lib/channels.ts`
- `src/lib/client-view.ts`
- `src/lib/compensation-data.ts`
- `src/lib/compensation.ts`
- `src/lib/db.ts`
- `src/lib/deliverables.ts`
- `src/lib/files.ts`
- `src/lib/meetings.ts`
- `src/lib/minutes.ts`
- `src/lib/openai.ts`
- `src/lib/pay.ts`
- `src/lib/request-origin.ts`
- `src/lib/settings.ts`
- `src/lib/tasks.ts`
- `src/lib/time.ts`
- `src/lib/timeline-document.ts`
- `src/lib/timeline-import.ts`
- `src/lib/timeline-track.ts`
- `src/lib/timeline.ts`
- `src/lib/upload-access.ts`
- `src/lib/upload-client.ts`
- `src/lib/upload-ticket.ts`
- `src/lib/web.ts`
- `src/lib/__tests__/ai-review.test.ts`
- `src/lib/__tests__/cloud-files.test.ts`
- `src/lib/__tests__/meetings.test.ts`
- `src/lib/__tests__/openai-review.test.ts`
- `src/lib/__tests__/openai.test.ts`
- `src/lib/__tests__/pay-workflow.test.ts`
- `src/lib/__tests__/pay.test.ts`
- `src/lib/__tests__/request-origin.test.ts`
- `src/lib/__tests__/tasks.test.ts`
- `src/lib/__tests__/timeline-ai.test.ts`
- `src/lib/__tests__/timeline-import.test.ts`
- `src/lib/__tests__/timeline-workflow.test.ts`
- `src/lib/__tests__/timeline.test.ts`
- `src/lib/__tests__/upload-access.test.ts`
- `src/lib/__tests__/fixtures/empty.pdf`
- `src/lib/__tests__/fixtures/timeline-table.docx`
- `src/lib/__tests__/fixtures/timeline-table.pdf`
- `src/lib/rules/defaults.ts`
- `src/lib/rules/index.ts`
- `src/lib/rules/schedule.ts`
- `src/lib/rules/scoring.ts`
- `src/lib/rules/types.ts`
- `src/lib/rules/__tests__/schedule.test.ts`
- `src/lib/rules/__tests__/scoring.test.ts`

## Workflow

- Node scripts: `npm run build`, `npm run db:push`, `npm run db:reset`, `npm run db:seed`, `npm run dev`, `npm run lint`, `npm run postinstall`, `npm run start`, `npm run test`, `npm run typecheck`
- Docker build workflow detected via `Dockerfile`.

## Module Inputs And Outputs

- `src/app/`: Next.js pages, server actions, and API routes for administrator, project manager, intern, channel, meeting, and client sharing workflows.
- `src/components/`: Reusable application, calendar, timeline, upload, and income views.
- `src/lib/`: Authentication, database access, upload authorization, timeline import, AI integration, and deterministic compensation and scoring rules.
- `prisma/`: Database schema and local demonstration seed data.
- `scripts/`: Prisma generation, standalone build sanitization, and guide screenshot tooling.
- `deploy/`: Vercel build scripts, production startup and administrator bootstrap, Docker Compose, and Caddy configuration.

## Data Stats Change

- Data-like files: 4
- `.json`: 4

## Feature Specs

- Existing application behavior is documented in `README.md` and `docs/`; this repository import does not change application behavior.
- GitHub destination prepared for approval: private `anne-creator/Aigeo-plus`, using the `main` branch.
- Real environment files, databases, uploads, dependencies, and build output stay ignored. `.env.example` and `deploy/production.env.example` provide setup templates.
- Import validation: source credential pattern scan and Git file manifest review. Application tests and builds are not run as part of this source import.

## Child Project Rollups

- No child project rollups recorded yet.

## Maintenance Log

- 2026-10-25 18:26:46 UTC: Bootstrap project documentation — git initialized
