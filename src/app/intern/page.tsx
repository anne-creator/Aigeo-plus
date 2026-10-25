import { UploadForm } from "@/components/upload-form";
import type { Prisma } from "@prisma/client";
import { Alert, Badge, Card, Empty } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/files";
import { dutyRoleLabel, formatMinutes } from "@/lib/tasks";
import { diffDays, formatBj, toBjYmd, WEEKDAY_CN, weekday } from "@/lib/time";
import { HashOpener, SubmitButton } from "./_components";
import { reopenTaskAction, submitDeliveryAction } from "./actions";

const taskInclude = {
  project: { select: { id: true, clientName: true } },
  createdBy: { select: { name: true } },
  batch: { select: { id: true, sourceText: true, sourceFileName: true, sourceFilePath: true } },
  submissions: { orderBy: { submittedAt: "desc" } },
} satisfies Prisma.InternTaskInclude;

type TaskRow = Prisma.InternTaskGetPayload<{ include: typeof taskInclude }>;

interface Group {
  key: string;
  clientName: string;
  todo: TaskRow[];
  done: TaskRow[];
}

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

/** 截止早的在前，没有截止日期的排最后；同一天按分配时间 */
function byDue(a: TaskRow, b: TaskRow): number {
  if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** 已完成：最近完成的在前 */
function byCompleted(a: TaskRow, b: TaskRow): number {
  return (b.completedAt ?? b.createdAt).getTime() - (a.completedAt ?? a.createdAt).getTime();
}

function dueLabel(ymd: string): string {
  return `${ymd.slice(5)}（${WEEKDAY_CN[weekday(ymd)]}）`;
}

function formatSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DueInfo({ task, today }: { task: TaskRow; today: string }) {
  if (!task.dueAt) return <span>未设截止日期</span>;
  const ymd = toBjYmd(task.dueAt);
  const late = task.status === "TODO" ? diffDays(today, ymd) : 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>截止 {dueLabel(ymd)}</span>
      {task.estimatedMinutes !== null ? <span>· 预计 {formatMinutes(task.estimatedMinutes)}</span> : null}
      {task.status === "TODO" && late > 0 ? <Badge tone="red">超期 {late} 天</Badge> : null}
      {task.status === "TODO" && late === 0 ? <Badge tone="amber">今天到期</Badge> : null}
    </span>
  );
}

function SourceLink({ task }: { task: TaskRow }) {
  const b = task.batch;
  if (!b) return null;
  if (b.sourceFilePath) {
    return (
      <a href={`/api/task-files/source/${b.id}`} className="text-accent underline underline-offset-2">
        任务原文{b.sourceFileName ? `（${b.sourceFileName}）` : ""}
      </a>
    );
  }
  return null;
}

function SourceText({ task }: { task: TaskRow }) {
  const b = task.batch;
  if (!b || b.sourceFilePath || !b.sourceText) return null;
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-accent">任务原文</summary>
      <div className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-foreground/80">{b.sourceText}</div>
    </details>
  );
}

function DeliveryForm({ task }: { task: TaskRow }) {
  return (
    <UploadForm action={submitDeliveryAction} purpose="task-delivery" targetId={task.id} className="space-y-3 rounded-lg border border-border bg-zinc-50 p-3 sm:p-4">
      <input type="hidden" name="taskId" value={task.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">粘贴链接</span>
          <input
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-blue-100 sm:text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">或上传文件（{MAX_MB}MB 以内）</span>
          <input
            name="file"
            type="file"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-zinc-100"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          备注 <span className="font-normal text-muted">（可不填）</span>
        </span>
        <input
          name="note"
          type="text"
          maxLength={300}
          placeholder="例如：已发布 3 篇，第 2 篇等审核"
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-blue-100 sm:text-sm"
        />
      </label>
      <SubmitButton pendingText="正在提交…" className="w-full px-5 py-2.5 text-base sm:w-auto">
        提交交付物
      </SubmitButton>
    </UploadForm>
  );
}

function PastDeliveries({ task }: { task: TaskRow }) {
  if (task.submissions.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-sm font-medium">已交付（{task.submissions.length}）</div>
      <ul className="space-y-1.5 text-sm">
        {task.submissions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-emerald-50/60 px-3 py-2">
            <span className="text-xs text-muted">{formatBj(s.submittedAt)}</span>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-accent underline underline-offset-2">
                {s.url}
              </a>
            ) : null}
            {s.filePath ? (
              <a href={`/api/task-files/delivery/${s.id}`} className="min-w-0 break-all text-accent underline underline-offset-2">
                {s.fileName ?? "下载文件"}
                {s.fileSize ? <span className="ml-1 text-xs text-muted no-underline">{formatSize(s.fileSize)}</span> : null}
              </a>
            ) : null}
            {s.note ? <span className="w-full text-foreground/70">{s.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlashMessage({ task, flash }: { task: TaskRow; flash: Flash | null }) {
  if (!flash || flash.taskId !== task.id) return null;
  if (flash.kind === "error") return <Alert tone="red">{flash.message}</Alert>;
  return <Alert tone="green">{flash.message}</Alert>;
}

type Flash = { taskId: string; kind: "error" | "saved"; message: string };

function TaskItem({ task, today, flash }: { task: TaskRow; today: string; flash: Flash | null }) {
  const done = task.status === "DONE";
  return (
    <li id={`task-${task.id}`} className="scroll-mt-4 space-y-3 py-5 first:pt-1 last:pb-1">
      <div>
        <h3 className={done ? "text-base font-medium text-foreground/60 line-through decoration-zinc-300" : "text-base font-semibold sm:text-lg"}>
          {task.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <DueInfo task={task} today={today} />
          <span>项目经理 {task.createdBy.name}</span>
          {done && task.completedAt ? <span>完成于 {formatBj(task.completedAt)}</span> : null}
          <SourceLink task={task} />
        </div>
        {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{task.description}</p> : null}
        <SourceText task={task} />
      </div>

      <FlashMessage task={task} flash={flash} />

      {done ? (
        <>
          <PastDeliveries task={task} />
          <div className="flex flex-wrap items-center gap-3">
            <details className="text-sm">
              <summary className="cursor-pointer text-accent">再交一份</summary>
              <div className="mt-2">
                <DeliveryForm task={task} />
              </div>
            </details>
            <form action={reopenTaskAction} className="ml-auto">
              <input type="hidden" name="taskId" value={task.id} />
              <SubmitButton variant="ghost" pendingText="处理中…" className="px-2 py-1 text-xs text-muted">
                标记未完成
              </SubmitButton>
            </form>
          </div>
        </>
      ) : (
        <>
          <DeliveryForm task={task} />
          <PastDeliveries task={task} />
        </>
      )}
    </li>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = value > 0 && tone === "red" ? "text-red-600" : value > 0 && tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default async function InternHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession(["INTERN"]);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const error = str("error");
  const saved = str("saved");
  const focusId = str("task");
  const today = toBjYmd(new Date());

  const [me, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.uid }, select: { name: true, dutyRole: true } }),
    prisma.internTask.findMany({ where: { assigneeId: session.uid }, include: taskInclude }),
  ]);

  const todo = tasks.filter((t) => t.status !== "DONE");
  const dueYmd = (t: TaskRow) => (t.dueAt ? toBjYmd(t.dueAt) : null);
  const dueToday = todo.filter((t) => dueYmd(t) === today).length;
  const overdue = todo.filter((t) => {
    const d = dueYmd(t);
    return d !== null && d < today;
  }).length;

  // 按客户分组
  const groupMap = new Map<string, Group>();
  for (const t of tasks) {
    const key = t.project?.id ?? "__other__";
    let g = groupMap.get(key);
    if (!g) {
      g = { key, clientName: t.project?.clientName ?? "其他", todo: [], done: [] };
      groupMap.set(key, g);
    }
    (t.status === "DONE" ? g.done : g.todo).push(t);
  }
  const groups = [...groupMap.values()];
  for (const g of groups) {
    g.todo.sort(byDue);
    g.done.sort(byCompleted);
  }
  // 有待完成的客户在前（按最早截止），“其他”放在同类最后
  const firstDue = (g: Group) => g.todo[0]?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  groups.sort((a, b) => {
    if ((a.todo.length > 0) !== (b.todo.length > 0)) return a.todo.length > 0 ? -1 : 1;
    if ((a.key === "__other__") !== (b.key === "__other__")) return a.key === "__other__" ? 1 : -1;
    return firstDue(a) - firstDue(b) || a.clientName.localeCompare(b.clientName, "zh-CN");
  });

  let flash: Flash | null = null;
  if (focusId && error) flash = { taskId: focusId, kind: "error", message: error };
  else if (focusId && saved === "1") {
    const t = tasks.find((x) => x.id === focusId);
    flash = { taskId: focusId, kind: "saved", message: t?.status === "DONE" ? "交付物已提交，任务已完成。" : "交付物已提交。" };
  } else if (focusId && saved === "reopened") flash = { taskId: focusId, kind: "saved", message: "已改回未完成。" };
  // 定位不到具体任务的错误放在页面顶部
  const topError = error && (!focusId || !tasks.some((t) => t.id === focusId)) ? error : null;

  return (
    <div className="space-y-6">
      <HashOpener />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">你好，{me?.name ?? session.name}</h1>
        <p className="mt-1.5">
          <Badge tone="blue" className="text-sm">
            {dutyRoleLabel(me?.dutyRole)}
          </Badge>
        </p>
        <p className="mt-2 text-sm text-muted">下面是项目经理分给你的任务。做完后在任务下面粘贴链接或上传文件，点“提交交付物”就完成了。</p>
      </div>

      {topError ? <Alert tone="red">{topError}</Alert> : null}

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="待完成" value={todo.length} />
        <StatBox label="今天到期" value={dueToday} tone="amber" />
        <StatBox label="已超期" value={overdue} tone="red" />
      </div>

      {groups.length === 0 ? (
        <Empty>项目经理还没有给你分配任务。</Empty>
      ) : (
        groups.map((g) => {
          const openDone = focusId !== null && g.done.some((t) => t.id === focusId);
          return (
            <Card key={g.key} className="p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                <h2 className="text-lg font-semibold">{g.clientName}</h2>
                <span className="text-sm text-muted">
                  {g.todo.length > 0 ? `${g.todo.length} 项待完成` : "全部完成"}
                </span>
              </div>
              {g.todo.length > 0 ? (
                <ul className="divide-y divide-border">
                  {g.todo.map((t) => (
                    <TaskItem key={t.id} task={t} today={today} flash={flash} />
                  ))}
                </ul>
              ) : null}
              {g.done.length > 0 ? (
                <details open={openDone} className="mt-3 rounded-lg bg-zinc-50 px-3 py-2">
                  <summary className="cursor-pointer py-1 text-sm font-medium text-muted">已完成 {g.done.length} 项</summary>
                  <ul className="divide-y divide-border">
                    {g.done.map((t) => (
                      <TaskItem key={t.id} task={t} today={today} flash={flash} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
