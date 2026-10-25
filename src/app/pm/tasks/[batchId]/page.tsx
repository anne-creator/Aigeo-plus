import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardTitle, Empty, LinkButton, PageHeader } from "@/components/ui";
import { canAccessProject, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dutyRoleLabel, formatMinutes, parseItemsJson } from "@/lib/tasks";
import { formatBj, toBjYmd } from "@/lib/time";
import { isDone, shortYmd, sp, taskState, TASKS_HREF } from "../_lib";
import { DraftEditor } from "./draft-editor";

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "zinc" }> = {
  DRAFT: { label: "待确认", tone: "amber" },
  CONFIRMED: { label: "已下发", tone: "green" },
  DISCARDED: { label: "已放弃", tone: "zinc" },
};

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession(["PM"]);
  const { batchId } = await params;
  const q = await searchParams;

  const batch = await prisma.taskBatch.findUnique({
    where: { id: batchId },
    include: { project: { select: { pmId: true, clientName: true } }, assignee: { select: { name: true } } },
  });
  if (!batch || !canAccessProject(session, batch.project)) notFound();

  const tasks =
    batch.status === "CONFIRMED"
      ? await prisma.internTask.findMany({
          where: { batchId: batch.id },
          include: { submissions: { orderBy: { submittedAt: "desc" } } },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        })
      : [];

  const now = new Date();
  const items = parseItemsJson(batch.itemsJson);
  const role = dutyRoleLabel(batch.dutyRole);
  const status = STATUS[batch.status] ?? STATUS.DISCARDED;
  const error = sp(q.error);
  const saved = sp(q.saved);
  const confirmed = sp(q.confirmed);
  const done = tasks.filter(isDone).length;
  const overdue = tasks.filter((t) => taskState(t, now).tone === "red").length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={batch.project.clientName}
        description={
          <>
            {role} · <span className="font-medium text-foreground">{batch.assignee.name}</span>{" "}
            <Badge tone={status.tone} className="ml-1 align-middle">
              {status.label}
            </Badge>
          </>
        }
        actions={
          <LinkButton href={TASKS_HREF} variant="secondary">
            返回
          </LinkButton>
        }
      />

      {error ? <Alert tone="red">{error}</Alert> : null}
      {saved ? <Alert tone="green">已保存修改，还没有下发。</Alert> : null}
      {confirmed ? (
        <Alert tone="green">
          已下发 {confirmed} 条，已进入 {batch.assignee.name} 的日历和待办。
        </Alert>
      ) : null}

      <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <summary className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-medium">原始内容</span>
          <span className="text-xs text-muted">
            {batch.parseMethod === "ai" ? "AI 整理" : "按规则整理"} · {formatBj(batch.createdAt)}
          </span>
        </summary>
        {batch.sourceFilePath ? (
          <a href={`/api/task-files/source/${batch.id}`} className="mt-3 inline-flex items-center gap-1 text-accent hover:underline">
            📎 {batch.sourceFileName ?? "下载原文档"}
          </a>
        ) : null}
        {batch.sourceText ? (
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 font-sans text-sm leading-6 text-foreground">
            {batch.sourceText}
          </pre>
        ) : null}
      </details>

      {batch.status === "DRAFT" ? (
        <Card>
          <CardTitle right={<span className="text-xs text-muted">核对日期和内容</span>}>任务清单</CardTitle>
          <DraftEditor batchId={batch.id} items={items} assigneeName={batch.assignee.name} />
        </Card>
      ) : batch.status === "CONFIRMED" ? (
        <Card>
          <CardTitle
            right={
              <div className="flex items-center gap-2">
                {overdue ? <Badge tone="red">{overdue} 条超期</Badge> : null}
                <Badge tone={tasks.length > 0 && done === tasks.length ? "green" : "neutral"}>
                  完成 {done}/{tasks.length}
                </Badge>
              </div>
            }
          >
            任务
          </CardTitle>
          {tasks.length === 0 ? (
            <Empty>这份清单里的任务已被删除。</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => {
                const st = taskState(t, now);
                return (
                  <li key={t.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <span className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-muted">{t.dueAt ? shortYmd(toBjYmd(t.dueAt)) : "—"}</span>
                      <div className="min-w-0 flex-1">
                        <div className={isDone(t) ? "text-muted" : "font-medium"}>{t.title}</div>
                        <div className="mt-0.5 text-xs text-muted">预计 {formatMinutes(t.estimatedMinutes)}</div>
                        {t.description ? <div className="mt-0.5 text-xs text-muted">{t.description}</div> : null}
                        {t.submissions.length ? (
                          <ul className="mt-2 space-y-1">
                            {t.submissions.map((s) => (
                              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="max-w-full truncate text-accent hover:underline">
                                    🔗 {s.url}
                                  </a>
                                ) : null}
                                {s.filePath ? (
                                  <a href={`/api/task-files/delivery/${s.id}`} className="max-w-full truncate text-accent hover:underline">
                                    📎 {s.fileName ?? "下载文件"}
                                  </a>
                                ) : null}
                                <span className="text-muted">{formatBj(s.submittedAt)}</span>
                                {s.note ? <span className="text-muted">· {s.note}</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <Badge tone={st.tone} className="shrink-0">
                        {st.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">下发于 {formatBj(batch.confirmedAt)} · 只读</p>
        </Card>
      ) : (
        <Card>
          <CardTitle>清单（已放弃，未下发）</CardTitle>
          {items.length === 0 ? (
            <p className="text-sm text-muted">没有内容。</p>
          ) : (
            <ul className="divide-y divide-border text-sm text-muted">
              {items.map((it, i) => (
                <li key={i} className="flex gap-3 py-2">
                  <span className="w-12 shrink-0 tabular-nums">{it.dueDate ? shortYmd(it.dueDate) : "—"}</span>
                  <span>{it.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
