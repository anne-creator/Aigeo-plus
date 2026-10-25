import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, Empty, LinkButton, money, pct, ReviewBadge, StatusBadge, Table, Td, Th } from "@/components/ui";
import type { DeliverableWithScore, TimelineItemWithScore } from "@/lib/deliverables";
import type { DeliverableScore } from "@/lib/rules";
import { diffDays, formatBj, toBjYmd } from "@/lib/time";
import { nodeHref, shortYmd, type PmQuarterSummary } from "./_lib";

/* ---------------- 通用 ---------------- */

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 横向进度条 */
export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "red" }) {
  const fill = tone === "red" ? "bg-red-500" : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={clampPct(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${clampPct(value)}%` }} />
    </div>
  );
}

/** 可折叠卡片（原生 details，无客户端 JS），默认收起 */
export function Collapsible({ title, hint, children, open }: { title: string; hint?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-xl border border-border bg-card shadow-sm" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold">{title}</span>
        <span className="flex items-center gap-3 text-xs text-muted">
          {hint}
          <span className="transition group-open:rotate-90" aria-hidden>
            ▸
          </span>
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4">{children}</div>
    </details>
  );
}

/** 距截止的一句话：逾期 N 天 / 今天截止 / N 天后 */
export function DueHint({ dueYmd, today, overdueDays }: { dueYmd: string; today: string; overdueDays?: number }) {
  const d = diffDays(dueYmd, today);
  if (d < 0) return <span className="font-medium text-red-700">逾期 {overdueDays ?? -d} 天</span>;
  if (d === 0) return <span className="font-medium text-accent">今天截止</span>;
  return <span className="text-muted">{d} 天后</span>;
}

/* ---------------- 下一步 ---------------- */

/** 未提交的节点按截止日排序取前 n 个（逾期的自然排在最前） */
export function nextUnsubmitted(items: DeliverableWithScore[], n: number): DeliverableWithScore[] {
  return items
    .filter((d) => !d.firstSubmittedAt)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, n);
}

export function NextSteps({ items, projectId, today }: { items: DeliverableWithScore[]; projectId: string; today: string }) {
  if (items.length === 0) return <p className="py-2 text-sm text-muted">全部节点都已提交。</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((d) => {
        const ymd = toBjYmd(d.dueAt);
        return (
          <li key={d.id} className="flex items-center gap-3 py-2.5">
            <span className="w-11 shrink-0 text-sm tabular-nums text-muted">{ymd.slice(5)}</span>
            <div className="min-w-0 flex-1">
              <Link href={nodeHref(projectId, d)} className="block truncate text-sm font-medium hover:underline">
                {d.title}
              </Link>
              <div className="text-xs">
                <DueHint dueYmd={ymd} today={today} overdueDays={d.score.lateDays} />
              </div>
            </div>
            <LinkButton href={nodeHref(projectId, d)} variant={d.score.status === "OVERDUE" ? "primary" : "secondary"} className="shrink-0 px-3 py-1 text-xs">
              {d.kind === "TIMELINE" ? "上传" : "提交"}
            </LinkButton>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- timeline 条目 ---------------- */

/** timeline 条目状态：已完成 / 待完成 / 宽限中 / 超期 N 天（含扣分） */
export function TimelineStatusCell({ t, today }: { t: TimelineItemWithScore; today: string }) {
  const s = t.score;
  if (s.status === "DONE") {
    return (
      <span className="text-emerald-700">
        已完成 <span className="text-xs">{formatBj(t.completedAt)}</span>
        {s.lateDays > 0 ? (
          <span className={`ml-1 text-xs ${s.deduction > 0 ? "text-red-700" : "text-amber-700"}`}>
            迟 {s.lateDays} 天{s.deduction > 0 ? `，扣 ${s.deduction.toFixed(2)} 分` : ""}
          </span>
        ) : null}
      </span>
    );
  }
  if (s.status === "TODO") {
    return <span className={t.dueDate === today ? "font-medium text-accent" : "text-muted"}>{t.dueDate === today ? "今天到期" : "待完成"}</span>;
  }
  if (s.status === "GRACE") {
    return (
      <span className="text-amber-700">
        宽限中 · 迟 {s.lateDays} 天<span className="ml-1 text-xs">（{s.graceDays - s.lateDays} 天后开始扣分）</span>
      </span>
    );
  }
  return (
    <span className="font-medium text-red-700">
      超期 {s.lateDays} 天 · 扣 {s.deduction.toFixed(2)} / {s.weight} 分
    </span>
  );
}

/* ---------------- 全部节点明细 ---------------- */

function LateDaysCell({ score }: { score: DeliverableScore }) {
  if (score.lateDays === -1) return <span className="text-red-700">未提交，扣满</span>;
  if (score.status === "OVERDUE") return <span className="text-red-700">逾期 {score.lateDays} 天</span>;
  if (score.lateDays > 0) return <span className="text-amber-700">{score.lateDays} 天</span>;
  return <span className="text-muted">—</span>;
}

function DeductionCell({ score }: { score: DeliverableScore }) {
  if (!score.counted) return <span className="text-muted">—</span>;
  return (
    <span className={score.totalDeduction > 0 ? "font-medium text-red-700" : ""}>
      {score.totalDeduction.toFixed(2)} / {score.weight}
      {score.projected && score.lateDays !== -1 ? <span className="ml-1 text-xs font-normal text-amber-700">预估</span> : null}
    </span>
  );
}

/** 全部节点明细表（按季度分组）；finalizedQuarters 里的季度按结算口径展示 */
export function DeliverableTable({
  items,
  projectId,
  finalizedQuarters,
}: {
  items: DeliverableWithScore[];
  projectId: string;
  finalizedQuarters?: ReadonlySet<number>;
}) {
  if (items.length === 0) return <Empty>尚未生成交付节点。</Empty>;
  const sorted = [...items].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const quarters = Array.from(new Set(sorted.map((d) => d.quarter))).sort((a, b) => a - b);
  return (
    <Table>
      <thead>
        <tr>
          <Th className="min-w-44">节点</Th>
          <Th>截止</Th>
          <Th>状态</Th>
          <Th>首次提交</Th>
          <Th>延期</Th>
          <Th>扣分 / 权重</Th>
          <Th>审核</Th>
        </tr>
      </thead>
      <tbody>
        {quarters.map((q) => {
          const rows = sorted.filter((d) => d.quarter === q);
          return [
            <tr key={`q-${q}`}>
              <Td colSpan={7} className="bg-zinc-50 text-xs font-semibold text-muted">
                第 {q} 季度 · {rows.length} 项
                {finalizedQuarters?.has(q) ? (
                  <Badge tone="green" className="ml-2 font-normal">
                    已结算
                  </Badge>
                ) : null}
              </Td>
            </tr>,
            ...rows.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href={nodeHref(projectId, d)} className="font-medium hover:underline">
                    {d.title}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{shortYmd(toBjYmd(d.dueAt))}</Td>
                <Td className="whitespace-nowrap">
                  <StatusBadge status={d.score.status} />
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{d.firstSubmittedAt ? formatBj(d.firstSubmittedAt).slice(5) : "—"}</Td>
                <Td className="whitespace-nowrap">
                  <LateDaysCell score={d.score} />
                </Td>
                <Td className="whitespace-nowrap">
                  <DeductionCell score={d.score} />
                </Td>
                <Td className="whitespace-nowrap">
                  <ReviewBadge status={d.reviewStatus} />
                </Td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </Table>
  );
}

/* ---------------- 季度考核 ---------------- */

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/** 季度考核卡片：已结算季度展示固化的结算单，未结算为实时测算 */
export function QuarterCard({ summary }: { summary: PmQuarterSummary }) {
  const { score, assessment, terminatedHere, display } = summary;
  const finalized = assessment !== null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">第 {summary.quarter} 季度</h2>
        {finalized ? <Badge tone="green">已结算</Badge> : <span className="text-xs text-muted">截至目前测算</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <div className="text-xs text-muted">交付得分</div>
          <div className={`text-3xl font-semibold tabular-nums ${display.scorePct < 80 ? "text-red-600" : ""}`}>{pct(display.scorePct)}</div>
        </div>
        <Figure label="效果达成率">{display.achievementPct === null ? <span className="text-sm font-normal text-muted">待录入</span> : pct(display.achievementPct)}</Figure>
        <Figure label="档位系数">{display.tierPct}%</Figure>
        <Figure label={finalized ? "季度 KPI 奖" : "预计 KPI 奖"}>{money(display.kpiBonusCny)}</Figure>
      </div>
      <p className="mt-4 text-xs text-muted">
        {finalized
          ? `结算于 ${formatBj(assessment.finalizedAt)}，数字已固化。`
          : `扣 ${score.totalDeduction.toFixed(2)} / ${score.totalWeight} 分 · 计入 ${score.countedItems} / ${score.totalItems} 项 · KPI 奖 = 月提成 ${money(display.monthlyCommissionCny)} × 档位 × 得分`}
      </p>
      {terminatedHere ? <p className="mt-1 text-xs text-red-700">项目已终止，当季 KPI 奖不发放。</p> : null}
    </Card>
  );
}
