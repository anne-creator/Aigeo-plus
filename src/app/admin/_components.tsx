import Link from "next/link";
import type { ReactNode } from "react";
import type { Project, TimelineItem } from "@prisma/client";
import { Badge, Button, Input, ReviewBadge, StatusBadge, Table, Td, Th, Textarea, money, pct } from "@/components/ui";
import type { DeliverableWithScore } from "@/lib/deliverables";
import {
  DELIVERABLE_META,
  PLAN_TIERS,
  PROJECT_STATUSES,
  labelOf,
  projectEndDate,
  quarterOfDate,
  type DeliverableCode,
  type TimelineItemScore,
  type TimelineStatus,
} from "@/lib/rules";
import { WEEKDAY_CN, formatBj, lateDays, weekday } from "@/lib/time";
import type { ProjectProgress } from "@/lib/timeline";
import { fileSizeText, kindLabel, projectStatusTone, timelineLateText, type LatestSubmission } from "./_lib";
import { aiRereviewAction, reviewAction } from "./projects/actions";
import { deleteTimelineItem, toggleTimelineItem, updateTimelineItem } from "./projects/[id]/timeline-actions";
import { websiteHref } from "@/lib/web";

/* -------------------------------- 项目头部 -------------------------------- */

export function ProjectHeader({ project, pmName, actions }: { project: Project; pmName: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.clientName}</h1>
          <Badge tone={projectStatusTone(project.status)}>{labelOf(PROJECT_STATUSES, project.status)}</Badge>
          <Badge tone="blue">{labelOf(PLAN_TIERS, project.planTier)}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          项目经理 {pmName} · 开始 {project.startDate} · 合同 {project.contractMonths} 个月（结束日 {projectEndDate(project.startDate, project.contractMonths)}）
          {project.terminationDate ? ` · 暂停/终止日 ${project.terminationDate}` : ""} · 月服务费 ${project.monthlyFeeUsd.toLocaleString("en-US")}
          {websiteHref(project.websiteUrl) ? (
            <>
              {" · "}
              <a href={websiteHref(project.websiteUrl)!} target="_blank" rel="noreferrer" className="underline">
                {project.websiteUrl}
              </a>
            </>
          ) : null}
        </p>
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/* --------------------------------- 项目进度 --------------------------------- */

/** 进度条：填充 = 完成进度；竖线 = 时间进度（今天在合同期的位置） */
export function ProgressBar({ pct: value, timePct, className }: { pct: number; timePct?: number; className?: string }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-zinc-100 ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${w >= 100 ? "bg-emerald-500" : "bg-accent"}`} style={{ width: `${w}%` }} />
      {timePct !== undefined && timePct > 0 && timePct < 100 ? (
        <div className="absolute inset-y-0 w-0.5 bg-zinc-500" style={{ left: `${timePct}%` }} title={`时间进度 ${timePct}%`} />
      ) : null}
    </div>
  );
}

/** 项目详情页头部下方的进度块 */
export function ProgressBlock({ p }: { p: ProjectProgress }) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">{p.donePct}%</span>
          <span className="text-sm text-muted">
            已完成 {p.doneItems} / {p.totalItems} 项
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted">
            第 {p.dayIndex} 天 / 共 {p.totalDays} 天
          </span>
          <span className={`ml-3 font-medium ${p.overdueItems > 0 ? "text-red-600" : "text-emerald-700"}`}>
            {p.overdueItems > 0 ? `逾期 ${p.overdueItems} 项` : "无逾期"}
          </span>
        </div>
      </div>
      <ProgressBar pct={p.donePct} timePct={p.timePct} className="mt-2" />
      <div className="mt-1 text-xs text-muted">
        系统节点 + timeline 条目 · 竖线为时间进度 {p.timePct}% · 到今天应完成 {p.dueSoFar} 项，已完成 {p.doneSoFar} 项
      </div>
    </div>
  );
}

/** 列表里的进度单元格 */
export function ProgressCell({ p }: { p: ProjectProgress }) {
  return (
    <div className="min-w-40">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{p.donePct}%</span>
        <span className="whitespace-nowrap text-muted">
          {p.doneItems}/{p.totalItems} 项 · 第 {p.dayIndex}/{p.totalDays} 天
        </span>
      </div>
      <ProgressBar pct={p.donePct} timePct={p.timePct} className="mt-1" />
      <div className={`mt-1 text-xs ${p.overdueItems > 0 ? "font-medium text-red-600" : "text-muted"}`}>逾期 {p.overdueItems}</div>
    </div>
  );
}

/* ------------------------------ timeline 条目 ------------------------------ */

export function TimelineBadge({ status }: { status: TimelineStatus }) {
  const map: Record<TimelineStatus, { label: string; tone: "blue" | "green" | "amber" | "red" }> = {
    TODO: { label: "待完成", tone: "blue" },
    DONE: { label: "已完成", tone: "green" },
    GRACE: { label: "宽限中", tone: "amber" },
    OVERDUE: { label: "已超期", tone: "red" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function TimelineDeductionCell({ score }: { score: TimelineItemScore }) {
  if (score.status === "TODO") return <span className="text-xs text-muted">—</span>;
  const text = timelineLateText(score);
  return (
    <div className="text-xs">
      <div className={score.deduction > 0 ? "font-medium text-red-600" : "font-medium"}>
        {score.deduction > 0 ? `−${score.deduction}` : "0"} / {score.weight} 分
      </div>
      {text ? <div className="text-muted">{text}</div> : null}
      {score.status === "OVERDUE" ? <div className="text-amber-700">预估，未完成仍在累计</div> : null}
    </div>
  );
}

export type TimelineRow = TimelineItem & {
  score: TimelineItemScore;
  createdBy: { name: string };
  completedBy: { name: string } | null;
};

function TimelineRowActions({ projectId, item }: { projectId: string; item: TimelineItem }) {
  const isDone = Boolean(item.completedAt);
  return (
    <div className="min-w-40 space-y-1.5">
      <div className="flex gap-1.5">
        <form action={toggleTimelineItem.bind(null, projectId, item.id, !isDone)}>
          <Button type="submit" variant={isDone ? "secondary" : "primary"} className="px-2.5 py-1 text-xs">
            {isDone ? "撤销完成" : "完成"}
          </Button>
        </form>
        <form action={deleteTimelineItem.bind(null, projectId, item.id)}>
          <Button type="submit" variant="ghost" className="px-2.5 py-1 text-xs text-red-700">
            删除
          </Button>
        </form>
      </div>
      <details className="rounded-lg border border-border bg-white">
        <summary className="cursor-pointer px-2.5 py-1 text-xs font-medium">编辑…</summary>
        <form action={updateTimelineItem.bind(null, projectId, item.id)} className="space-y-2 border-t border-border p-2">
          <Input name="dueDate" type="date" defaultValue={item.dueDate} required className="text-xs" />
          <Input name="title" defaultValue={item.title} required maxLength={200} className="text-xs" />
          <Button type="submit" variant="secondary" className="w-full px-2.5 py-1 text-xs">
            保存
          </Button>
        </form>
      </details>
    </div>
  );
}

/** 管理员视角的 timeline 条目表：可完成/撤销、改日期和标题、删除；已结算季度的条目锁定 */
export function TimelineItemsTable({
  projectId,
  startDate,
  items,
  finalizedQuarters,
}: {
  projectId: string;
  startDate: string;
  items: TimelineRow[];
  finalizedQuarters: ReadonlySet<number>;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>日期</Th>
          <Th>事项</Th>
          <Th>状态</Th>
          <Th>完成时间</Th>
          <Th>扣分 / 权重</Th>
          <Th>操作</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => {
          const locked = finalizedQuarters.has(quarterOfDate(startDate, t.dueDate));
          return (
            <tr key={t.id} id={`t-${t.id}`} className="scroll-mt-20 target:bg-amber-50">
              <Td className="whitespace-nowrap">
                <div className="font-medium">{t.dueDate}</div>
                <div className="text-xs text-muted">{WEEKDAY_CN[weekday(t.dueDate)]}</div>
              </Td>
              <Td className="min-w-48">
                <div className={t.completedAt ? "text-muted" : "font-medium"}>{t.title}</div>
                <div className="text-xs text-muted">{t.createdBy.name} 添加</div>
              </Td>
              <Td className="whitespace-nowrap">
                <TimelineBadge status={t.score.status} />
              </Td>
              <Td className="whitespace-nowrap text-xs">
                {t.completedAt ? (
                  <>
                    {formatBj(t.completedAt)}
                    <div className="text-muted">{t.completedBy?.name ?? ""}</div>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="min-w-40">
                <TimelineDeductionCell score={t.score} />
              </Td>
              <Td className="whitespace-nowrap">{locked ? <span className="text-xs text-muted">季度已结算</span> : <TimelineRowActions projectId={projectId} item={t} />}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/* --------------------------------- 标签页 --------------------------------- */

export function Tabs({ items }: { items: Array<{ href: string; label: string; active: boolean; count?: number }> }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={
            t.active
              ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-md px-3 py-1.5 text-sm text-foreground/80 hover:bg-zinc-100"
          }
        >
          {t.label}
          {t.count !== undefined ? <span className="ml-1 text-xs opacity-70">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

/* -------------------------------- 提交预览 -------------------------------- */

export function SubmissionPreview({ sub }: { sub: LatestSubmission | undefined }) {
  if (!sub) return <span className="text-muted">—</span>;
  const text = sub.textContent ?? "";
  return (
    <div className="max-w-xs text-xs">
      {sub.fileName ? (
        <a href={`/api/files/${sub.id}`} className="font-medium text-accent underline break-all">
          {sub.fileName}
        </a>
      ) : (
        <p className="whitespace-pre-wrap break-words text-foreground">{text.length > 120 ? `${text.slice(0, 120)}…` : text}</p>
      )}
      <p className="mt-1 text-muted">
        第 {sub.version} 版 · {sub.submittedBy.name} · {formatBj(sub.submittedAt)}
        {sub.fileSize ? ` · ${fileSizeText(sub.fileSize)}` : ""}
      </p>
      {sub.note ? <p className="mt-0.5 text-muted">备注：{sub.note}</p> : null}
    </div>
  );
}

/* -------------------------------- 审核表单 -------------------------------- */

/** 审核结论来自 AI 还是管理员 */
export function ReviewSourceTag({ source }: { source: string }) {
  return <span className="ml-1 text-xs text-muted">{source === "AI" ? "· AI 自动" : "· 管理员"}</span>;
}

export function ReviewForms({
  deliverableId,
  reviewStatus,
  hasSubmission,
  back,
  defaultPct,
  locked,
}: {
  deliverableId: string;
  reviewStatus: string;
  hasSubmission: boolean;
  back: string;
  defaultPct: number;
  /** 所属季度已结算固化：不再提供审核操作 */
  locked?: boolean;
}) {
  if (!hasSubmission) return <span className="text-xs text-muted">未提交</span>;
  if (locked) return <span className="text-xs text-muted">季度已结算，撤销结算后才能改审核</span>;
  const hidden = (decision: string) => (
    <>
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="redirect" value={back} />
    </>
  );
  return (
    <div className="flex min-w-44 flex-col gap-2">
      {reviewStatus !== "APPROVED" ? (
        <form action={reviewAction}>
          {hidden("APPROVED")}
          <Button type="submit" variant="primary" className="w-full px-2.5 py-1 text-xs">
            通过
          </Button>
        </form>
      ) : null}
      {reviewStatus !== "REJECTED" ? (
        <details className="rounded-lg border border-border bg-white">
          <summary className="cursor-pointer px-2.5 py-1 text-xs font-medium text-red-700">不通过…</summary>
          <form action={reviewAction} className="space-y-2 border-t border-border p-2">
            {hidden("REJECTED")}
            <Textarea name="note" required placeholder="审核意见（必填）：哪里与季初约定不符" className="min-h-20 text-xs" />
            <Input name="pct" type="number" min={0} max={100} step={1} placeholder={`扣分比例，留空＝默认 ${defaultPct}%`} className="text-xs" />
            <Button type="submit" variant="danger" className="w-full px-2.5 py-1 text-xs">
              标记不通过
            </Button>
          </form>
        </details>
      ) : null}
      {reviewStatus === "APPROVED" || reviewStatus === "REJECTED" ? (
        <form action={reviewAction}>
          {hidden("PENDING")}
          <Button type="submit" variant="ghost" className="w-full px-2.5 py-1 text-xs">
            重置为待审核
          </Button>
        </form>
      ) : null}
      <form action={aiRereviewAction}>
        {hidden("PENDING")}
        <Button type="submit" variant="ghost" className="w-full px-2.5 py-1 text-xs">
          重新 AI 审核
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------- 扣分明细单元 ------------------------------- */

export function DeductionCell({ score }: { score: DeliverableWithScore["score"] }) {
  const s = score;
  return (
    <div className="text-xs">
      <div className="font-medium">
        {s.totalDeduction} / {s.weight} 分
      </div>
      <div className="text-muted">
        延期 {pct(s.latePct, 0)}
        {s.reviewPct > 0 ? ` · 审核 ${pct(s.reviewPct, 0)}` : ""}
      </div>
      {!s.counted ? <div className="text-muted">未计入（未到期）</div> : null}
      {s.projected && s.counted ? <div className="text-amber-700">预估，未提交仍在累计</div> : null}
    </div>
  );
}

export function LateDaysCell({ score, status }: { score: DeliverableWithScore["score"]; status: string }) {
  if (score.lateDays === -1) return <span className="text-red-600">扣满</span>;
  if (score.lateDays === 0) return <span className="text-muted">0</span>;
  return (
    <span className={status === "OVERDUE" ? "text-red-600" : "text-amber-700"}>
      {score.lateDays} 天{status === "OVERDUE" ? "（截至目前）" : ""}
    </span>
  );
}

/* ------------------------------- 交付时间线 ------------------------------- */

export function DeliverableTimeline({
  items,
  latest,
  back,
  defaultRejectPct,
  finalizedQuarters,
}: {
  items: DeliverableWithScore[];
  latest: Map<string, LatestSubmission>;
  back: string;
  defaultRejectPct: number;
  /** 已结算固化的季度：这些季度的节点不再提供审核操作 */
  finalizedQuarters?: ReadonlySet<number>;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>交付物</Th>
          <Th>形式</Th>
          <Th>截止（北京）</Th>
          <Th>状态</Th>
          <Th>首次提交</Th>
          <Th>延期</Th>
          <Th>扣分 / 权重</Th>
          <Th>审核</Th>
          <Th>最新提交</Th>
          <Th>审核操作</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((d) => {
          const sub = latest.get(d.id);
          const meta = DELIVERABLE_META[d.code as DeliverableCode];
          return (
            <tr key={d.id} id={`d-${d.id}`} className="scroll-mt-20 target:bg-amber-50">
              <Td>
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-muted">
                  第 {d.quarter} 季度 · {d.periodLabel}
                  {meta ? ` · ${meta.name}` : ""}
                </div>
              </Td>
              <Td className="whitespace-nowrap text-xs">{kindLabel(d.kind)}</Td>
              <Td className="whitespace-nowrap text-xs">
                {formatBj(d.dueAt)}
              </Td>
              <Td>
                <StatusBadge status={d.score.status} />
              </Td>
              <Td className="whitespace-nowrap text-xs">{formatBj(d.firstSubmittedAt)}</Td>
              <Td className="whitespace-nowrap text-xs">
                <LateDaysCell score={d.score} status={d.score.status} />
              </Td>
              <Td>
                <DeductionCell score={d.score} />
              </Td>
              <Td>
                <ReviewBadge status={d.reviewStatus} />
                {d.reviewSource ? <ReviewSourceTag source={d.reviewSource} /> : null}
                {d.reviewStatus === "REJECTED" ? (
                  <div className="mt-1 max-w-48 text-xs text-red-700">
                    {d.reviewNote}
                    <div className="text-muted">扣 {pct(d.reviewDeductionPct ?? defaultRejectPct, 0)} · {formatBj(d.reviewedAt)}</div>
                  </div>
                ) : d.reviewedAt ? (
                  <div className="mt-1 text-xs text-muted">{formatBj(d.reviewedAt)}</div>
                ) : null}
              </Td>
              <Td>
                {d.kind === "TIMELINE" ? (
                  <div className="max-w-xs text-xs">
                    <div>
                      在 timeline 页维护 ·{" "}
                      <a href="#project-timeline" className="font-medium text-accent underline">
                        查看条目
                      </a>
                    </div>
                    {sub ? (
                      <p className="mt-1 text-muted">
                        第 {sub.version} 版 · {sub.submittedBy.name} · {formatBj(sub.submittedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <SubmissionPreview sub={sub} />
                )}
              </Td>
              <Td>
                <ReviewForms
                  deliverableId={d.id}
                  reviewStatus={d.reviewStatus}
                  hasSubmission={Boolean(sub)}
                  back={`${back}#d-${d.id}`}
                  defaultPct={defaultRejectPct}
                  locked={finalizedQuarters?.has(d.quarter)}
                />
              </Td>
            </tr>
          );
        })}
        {items.length === 0 ? (
          <tr>
            <Td colSpan={10} className="text-center text-muted">
              暂无交付节点
            </Td>
          </tr>
        ) : null}
      </tbody>
    </Table>
  );
}

/* --------------------------- 季度 KPI 奖规则小表 --------------------------- */

export function BonusRules({ commissionRate }: { commissionRate: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-xs text-muted">
      <div className="font-medium text-foreground">季度 KPI 奖 = 月提成 × 档位系数 × 季度交付得分</div>
      <div className="mt-1">月提成 = 月服务费（美元）× 汇率 × {pct(commissionRate * 100, 0)}；效果达成率 = 实际 ShowUp 率 ÷ 合同目标 ShowUp 率</div>
      <table className="mt-2 text-xs">
        <tbody>
          <tr>
            <td className="pr-4">达成率 ≥ 130%</td>
            <td>档位系数 100%</td>
          </tr>
          <tr>
            <td className="pr-4">100%（含）– 130%（不含）</td>
            <td>档位系数 60%</td>
          </tr>
          <tr>
            <td className="pr-4">&lt; 100%</td>
            <td>档位系数 0（不发）</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function MoneyLine({ label, value, strong }: { label: string; value: number | null | undefined; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>{money(value)}</span>
    </div>
  );
}

/** 负责人任务状态：待完成 / 已完成（迟 N 天）/ 超期 N 天 */
export function TaskStatusBadge({ task, now }: { task: { status: string; dueAt: Date | null; completedAt: Date | null }; now: Date }) {
  if (task.status === "DONE") {
    const late = task.dueAt && task.completedAt ? lateDays(task.dueAt, task.completedAt) : 0;
    return (
      <span className="whitespace-nowrap">
        <Badge tone="green">已完成</Badge>
        {late > 0 ? <span className="ml-1 text-xs text-amber-700">迟 {late} 天</span> : null}
      </span>
    );
  }
  const overdue = task.dueAt ? lateDays(task.dueAt, now) : 0;
  return overdue > 0 ? <Badge tone="red">超期 {overdue} 天</Badge> : <Badge tone="blue">待完成</Badge>;
}
