import { UploadForm } from "@/components/upload-form";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Badge, Card, CardTitle, Empty, LinkButton, PageHeader, Select } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DUTY_ROLES, dutyRoleLabel, listAssignees, parseItemsJson, TASK_DOC_EXTENSIONS } from "@/lib/tasks";
import { formatBj } from "@/lib/time";
import { SourceInputs, SubmitButton } from "./_components";
import { ASSIGNABLE_STATUSES, batchHref, isDone, projectScope, sp, taskState } from "./_lib";
import { createBatchAction } from "./actions";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{n}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-sm font-semibold">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default async function AssignTasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(["PM"]);
  const q = await searchParams;
  const scope = projectScope(session);
  const isAdmin = session.role === "ADMIN";

  const [projects, assignees, drafts, confirmed] = await Promise.all([
    prisma.project.findMany({
      where: { ...scope, status: { in: ASSIGNABLE_STATUSES } },
      select: { id: true, clientName: true, pm: { select: { name: true } } },
      orderBy: { clientName: "asc" },
    }),
    listAssignees(),
    prisma.taskBatch.findMany({
      where: { status: "DRAFT", project: scope },
      include: { project: { select: { clientName: true } }, assignee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.taskBatch.findMany({
      where: { status: "CONFIRMED", project: scope },
      include: {
        project: { select: { clientName: true } },
        assignee: { select: { name: true } },
        tasks: { select: { status: true, completedAt: true, dueAt: true } },
      },
      orderBy: { confirmedAt: "desc" },
      take: 20,
    }),
  ]);

  const now = new Date();
  const error = sp(q.error);
  const discarded = sp(q.discarded);
  const defaultProject = projects.some((p) => p.id === sp(q.project)) ? sp(q.project) : undefined;
  const defaultRole = sp(q.role);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="分配任务" description="写清要做的事和 DDL，系统整理成清单，确认后进入负责人的日历和待办。" />

      {error ? <Alert tone="red">{error}</Alert> : null}
      {discarded ? <Alert tone="amber">已放弃这份清单。</Alert> : null}

      <Card>
        {projects.length === 0 ? (
          <Empty>
            还没有进行中的客户。
            <div className="mt-3">
              <LinkButton href="/pm/projects/new" variant="secondary">
                新建客户档案
              </LinkButton>
            </div>
          </Empty>
        ) : (
          <UploadForm action={createBatchAction} purpose="task-source" className="space-y-6">
            <Step n={1} title="客户">
              <Select name="projectId" required defaultValue={defaultProject} aria-label="客户" className="sm:max-w-sm">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName}
                    {isAdmin ? `（${p.pm.name}）` : ""}
                  </option>
                ))}
              </Select>
            </Step>

            <Step n={2} title="负责人">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DUTY_ROLES.map((r) => {
                  const people = assignees.filter((a) => a.dutyRole === r.value);
                  const none = people.length === 0;
                  return (
                    <div
                      key={r.value}
                      className={
                        none
                          ? "rounded-xl border border-border bg-zinc-50 p-3 opacity-60"
                          : "rounded-xl border border-border bg-white p-3 transition hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-blue-50 has-[:checked]:ring-2 has-[:checked]:ring-blue-100"
                      }
                    >
                      <label className={none ? "flex cursor-not-allowed items-center gap-2" : "flex cursor-pointer items-center gap-2"}>
                        <input
                          type="radio"
                          name="dutyRole"
                          value={r.value}
                          required
                          disabled={none}
                          defaultChecked={!none && defaultRole === r.value}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="font-medium">{r.label}</span>
                      </label>
                      <div className="mt-1.5 pl-6 text-sm text-muted">
                        {none ? (
                          "暂无人员"
                        ) : people.length === 1 ? (
                          people[0].name
                        ) : (
                          <Select name={`assignee_${r.value}`} defaultValue={people[0].id} aria-label={`${r.label}人选`} className="py-1.5">
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Step>

            <Step n={3} title="任务内容（写清要做的事和 DDL）">
              <SourceInputs accept={TASK_DOC_EXTENSIONS.join(",")} />
            </Step>

            <div className="flex justify-end border-t border-border pt-4">
              <SubmitButton pendingText="整理中…" className="w-full px-6 py-2.5 sm:w-auto">
                整理成清单 →
              </SubmitButton>
            </div>
          </UploadForm>
        )}
      </Card>

      <Card>
        <CardTitle right={drafts.length ? <Badge tone="amber">{drafts.length}</Badge> : null}>待确认</CardTitle>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">没有待确认的清单。</p>
        ) : (
          <ul className="divide-y divide-border">
            {drafts.map((b) => {
              const items = parseItemsJson(b.itemsJson);
              const noDate = items.filter((i) => !i.dueDate).length;
              return (
                <li key={b.id}>
                  <Link href={batchHref(b.id)} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-zinc-50">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.project.clientName}</div>
                      <div className="truncate text-xs text-muted">
                        {dutyRoleLabel(b.dutyRole)} · {b.assignee.name} · {formatBj(b.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm text-muted">{items.length} 条</span>
                      {noDate ? <Badge tone="red">{noDate} 条缺日期</Badge> : null}
                      <span className="text-sm font-medium text-accent">去确认 →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle right={<span className="text-xs text-muted">最近 20 份</span>}>已下发</CardTitle>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted">还没有下发过任务。</p>
        ) : (
          <ul className="divide-y divide-border">
            {confirmed.map((b) => {
              const done = b.tasks.filter(isDone).length;
              const overdue = b.tasks.filter((t) => taskState(t, now).tone === "red").length;
              const allDone = b.tasks.length > 0 && done === b.tasks.length;
              return (
                <li key={b.id}>
                  <Link href={batchHref(b.id)} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-zinc-50">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.project.clientName}</div>
                      <div className="truncate text-xs text-muted">
                        {dutyRoleLabel(b.dutyRole)} · {b.assignee.name} · {formatBj(b.confirmedAt ?? b.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {overdue ? <Badge tone="red">{overdue} 条超期</Badge> : null}
                      <Badge tone={allDone ? "green" : "neutral"}>
                        完成 {done}/{b.tasks.length}
                      </Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
