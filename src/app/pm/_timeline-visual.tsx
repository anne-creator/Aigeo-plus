import Link from "next/link";
import { Fragment } from "react";
import type { Deliverable } from "@prisma/client";
import type { DeliverableScore, DeliverableStatus } from "@/lib/rules";
import { mergeTimelineGroups } from "@/lib/timeline-track";
import { diffDays, endOfDayBj, toBjYmd } from "@/lib/time";
import { nodeHref } from "./_lib";

/**
 * 可视化交付时间线（Server Component，无客户端 JS）。
 * 主节点按阶段分组排成一条横向轨道；周一复盘是轨道下方一排小圆点；
 * 每个节点都是链接，可以直接跳到任意一步提交。
 */

export type TrackItem = Pick<Deliverable, "id" | "code" | "seq" | "kind" | "title" | "dueAt" | "reviewStatus"> & {
  score: Pick<DeliverableScore, "status" | "lateDays">;
  isPlan?: boolean;
};

interface Group {
  key: string;
  label: string;
  steps: TrackItem[];
}

const SHORT: Record<string, string> = {
  PROMPT_POOL: "提示词池",
  BASELINE_PLAN: "基线报告",
  PROJECT_TIMELINE: "项目 timeline",
  SITE_CHECKLIST: "官网 checklist",
  KNOWLEDGE_BASE: "知识库",
  MONTHLY_REPORT: "月报",
  DISTRIBUTION_LIST: "分发清单",
  QUARTER_REPORT: "季末报告",
  RENEWAL_PLAN: "续约计划",
  QUARTER_PLAN: "季度规划",
};

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  OPEN: "待提交",
  ON_TIME: "按时提交",
  LATE: "延期提交",
  OVERDUE: "已逾期",
};

const WEEK1 = ["PROMPT_POOL", "BASELINE_PLAN", "PROJECT_TIMELINE"];
const WEEK23 = ["SITE_CHECKLIST", "KNOWLEDGE_BASE"];
const MONTHLY = ["MONTHLY_REPORT", "DISTRIBUTION_LIST"];

const byDue = (a: TrackItem, b: TrackItem) => a.dueAt.getTime() - b.dueAt.getTime() || a.seq - b.seq;
const ymdOf = (d: TrackItem) => toBjYmd(d.dueAt);

/** 主节点分组：第 1 周 / 第 2–3 周 / 每个服务月 / 季末；周一复盘单独返回 */
export function buildTrack(items: TrackItem[]): { groups: Group[]; weekly: TrackItem[] } {
  const weekly = items.filter((d) => d.code === "WEEKLY_UPDATE").sort(byDue);
  const main = items.filter((d) => d.code !== "WEEKLY_UPDATE" && !d.isPlan);
  const planned = items.filter((d) => d.isPlan);
  const pick = (codes: string[]) => main.filter((d) => codes.includes(d.code)).sort(byDue);

  const groups: Group[] = [];
  const push = (key: string, label: string, steps: TrackItem[]) => {
    if (steps.length > 0) groups.push({ key, label, steps });
  };
  push("w1", "第 1 周", pick(WEEK1));
  push("w23", "第 2–3 周", pick(WEEK23));

  const monthly = pick(MONTHLY);
  const quarterly = pick(["QUARTER_REPORT"]);
  const multiQuarter = quarterly.length > 1;
  const months = Array.from(new Set(monthly.map((d) => d.seq))).sort((a, b) => a - b);
  const usedQuarters = new Set<number>();
  for (const m of months) {
    push(`m${m}`, `第 ${m} 月`, monthly.filter((d) => d.seq === m));
    if (m % 3 === 0) {
      const q = quarterly.filter((d) => d.seq === m / 3);
      q.forEach((d) => usedQuarters.add(d.seq));
      push(`q${m / 3}`, multiQuarter ? `第 ${m / 3} 季末` : "季末", q);
    }
  }
  const restQ = quarterly.filter((d) => !usedQuarters.has(d.seq));
  for (const d of restQ) push(`q${d.seq}`, multiQuarter ? `第 ${d.seq} 季末` : "季末", [d]);

  // 其它（建议项等）：按截止日插到对应位置，保证轨道整体按时间排列
  const known = new Set([...WEEK1, ...WEEK23, ...MONTHLY, "QUARTER_REPORT"]);
  for (const d of main.filter((x) => !known.has(x.code)).sort(byDue)) {
    const at = groups.findIndex((g) => g.steps[0].dueAt.getTime() > d.dueAt.getTime());
    const g: Group = { key: `x-${d.id}`, label: SHORT[d.code] ?? d.title, steps: [d] };
    if (at === -1) groups.push(g);
    else groups.splice(at, 0, g);
  }
  return { groups: planned.length ? mergeTimelineGroups(groups, planned, ymdOf) : groups, weekly };
}

/* ---------------- 颜色 ---------------- */

const CIRCLE: Record<DeliverableStatus, string> = {
  ON_TIME: "bg-emerald-500 text-white",
  LATE: "bg-amber-500 text-white",
  OVERDUE: "bg-red-500 text-white",
  OPEN: "border-2 border-accent bg-white text-accent",
};
const DOT: Record<DeliverableStatus, string> = {
  ON_TIME: "bg-emerald-500",
  LATE: "bg-amber-500",
  OVERDUE: "bg-red-500",
  OPEN: "border-[1.5px] border-accent bg-white",
};
const ICON: Record<DeliverableStatus, string> = { ON_TIME: "✓", LATE: "✓", OVERDUE: "!", OPEN: "" };

function tip(d: TrackItem): string {
  const late = d.score.status === "OVERDUE" ? ` ${d.score.lateDays} 天` : "";
  const rejected = d.reviewStatus === "REJECTED" ? " · 审核不通过" : "";
  return `${d.title} · ${toBjYmd(d.dueAt).slice(5)} 截止 · ${STATUS_LABEL[d.score.status]}${late}${rejected}`;
}

/* ---------------- 完整版 ---------------- */

const GAP = 0.5; // 阶段之间的间隔（单位：一个节点宽）
const UNIT_PX = 56; // 每个节点的最小宽度；超出卡片宽度时在卡片内横向滚动

interface Anchor {
  ymd: string;
  x: number;
}

/** 日期 → 横坐标（单位）：按节点截止日做分段线性插值，今天标记与周一圆点都用它 */
function makeXOf(anchors: Anchor[], total: number) {
  return (ymd: string): number => {
    if (anchors.length === 0) return 0;
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (ymd <= first.ymd) return ymd === first.ymd ? first.x : Math.max(0, first.x - 0.5);
    if (ymd >= last.ymd) return ymd === last.ymd ? last.x : Math.min(total, last.x + 0.5);
    for (let i = 1; i < anchors.length; i++) {
      const b = anchors[i];
      if (ymd <= b.ymd) {
        const a = anchors[i - 1];
        if (ymd === b.ymd) return b.x;
        return a.x + ((b.x - a.x) * diffDays(ymd, a.ymd)) / diffDays(b.ymd, a.ymd);
      }
    }
    return last.x;
  };
}

export function TimelineVisual({ projectId, items, today, timeline = [] }: {
  projectId: string; items: TrackItem[]; today: string;
  timeline?: Array<{ id: string; title: string; dueDate: string; completedAt: Date | null }>;
}) {
  const planned: TrackItem[] = timeline.map((t, i) => ({
    id: t.id, title: t.title, code: "CONFIRMED_PLAN", kind: "TIMELINE", seq: i + 1,
    dueAt: endOfDayBj(t.dueDate), reviewStatus: "APPROVED", isPlan: true,
    score: {
      status: t.completedAt ? (toBjYmd(t.completedAt) <= t.dueDate ? "ON_TIME" : "LATE") : t.dueDate < today ? "OVERDUE" : "OPEN",
      lateDays: t.completedAt ? Math.max(0, diffDays(toBjYmd(t.completedAt), t.dueDate)) : Math.max(0, diffDays(today, t.dueDate)),
    },
  }));
  const { groups, weekly } = buildTrack([...items, ...planned]);
  if (groups.length === 0) return <p className="text-sm text-muted">尚未生成交付节点。</p>;

  // 布局：每个节点 1 个单位，阶段之间留 GAP
  const centers = new Map<string, number>();
  let cursor = 0;
  groups.forEach((g, gi) => {
    if (gi > 0) cursor += GAP;
    g.steps.forEach((s, si) => centers.set(s.id, cursor + si + 0.5));
    cursor += g.steps.length;
  });
  const total = cursor;
  const steps = groups.flatMap((g) => g.steps);

  // 同一天截止的多个节点取平均位置作为锚点
  const byDate = new Map<string, number[]>();
  for (const s of steps) byDate.set(ymdOf(s), [...(byDate.get(ymdOf(s)) ?? []), centers.get(s.id) ?? 0]);
  const anchors: Anchor[] = Array.from(byDate.entries())
    .map(([ymd, xs]) => ({ ymd, x: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => (a.ymd < b.ymd ? -1 : 1));
  const xOf = makeXOf(anchors, total);
  const pctOf = (x: number) => `${(x / total) * 100}%`;

  const firstX = centers.get(steps[0].id) ?? 0;
  const lastX = centers.get(steps[steps.length - 1].id) ?? total;
  const todayX = xOf(today);
  const passedRight = Math.min(Math.max(todayX, firstX), lastX);
  const weeklyFirstX = weekly.length > 0 ? xOf(ymdOf(weekly[0])) : 0;
  const labelAlign = todayX < 0.4 ? "" : todayX > total - 0.4 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="relative pt-6" style={{ minWidth: `${total * (planned.length ? 95 : UNIT_PX)}px` }}>
        {/* 阶段标签 */}
        <div className="flex">
          {groups.map((g, gi) => (
            <Fragment key={g.key}>
              {gi > 0 ? <div style={{ flex: `${GAP} 1 0` }} /> : null}
              <div style={{ flex: `${g.steps.length} 1 0` }} className="min-w-0 border-b border-border pb-1 text-center text-xs font-medium text-muted">
                {g.label}
              </div>
            </Fragment>
          ))}
        </div>

        {/* 主轨道 */}
        <div className="relative mt-3">
          <div className="absolute top-[13px] h-0.5 bg-zinc-200" style={{ left: pctOf(firstX), right: `calc(100% - ${pctOf(lastX)})` }} />
          {passedRight > firstX ? (
            <div className="absolute top-[13px] h-0.5 bg-accent/40" style={{ left: pctOf(firstX), width: `${((passedRight - firstX) / total) * 100}%` }} />
          ) : null}
          <div className="relative flex">
            {groups.map((g, gi) => (
              <Fragment key={g.key}>
                {gi > 0 ? <div style={{ flex: `${GAP} 1 0` }} /> : null}
                {g.steps.map((s) => {
                  const ymd = ymdOf(s);
                  return (
                    <Link
                      key={s.id}
                      href={s.isPlan ? `/pm/projects/${projectId}/timeline#item-${s.id}` : nodeHref(projectId, s)}
                      title={tip(s)}
                      aria-label={tip(s)}
                      style={{ flex: "1 1 0" }}
                      className="group flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 pb-1 text-center"
                    >
                      <span
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition group-hover:ring-4 group-hover:ring-blue-100 ${CIRCLE[s.score.status]}`}
                      >
                        {ICON[s.score.status]}
                        {s.reviewStatus === "REJECTED" ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
                        ) : null}
                      </span>
                      <span className="text-[11px] leading-tight text-foreground group-hover:text-accent">{SHORT[s.code] ?? s.title}</span>
                      <span className={`text-[11px] tabular-nums ${ymd === today ? "font-semibold text-accent" : "text-muted"}`}>{ymd.slice(5)}</span>
                    </Link>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* 周一复盘：一周一个小圆点 */}
        {weekly.length > 0 ? (
          <div className="relative mt-2 h-6">
            {weeklyFirstX >= 1.2 ? <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] text-muted">周一复盘</span> : null}
            {weekly.map((w) => (
              <Link
                key={w.id}
                href={nodeHref(projectId, w)}
                title={tip(w)}
                aria-label={tip(w)}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5"
                style={{ left: pctOf(xOf(ymdOf(w))) }}
              >
                <span className={`block h-2.5 w-2.5 rounded-full transition group-hover:scale-150 ${DOT[w.score.status]}`} />
              </Link>
            ))}
          </div>
        ) : null}

        {/* 今天 */}
        <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: pctOf(todayX) }} aria-hidden>
          <span className={`absolute top-0 ${labelAlign} whitespace-nowrap rounded bg-accent px-1.5 py-px text-[10px] font-medium text-white`}>今天</span>
          <span className="absolute bottom-0 top-4 w-px -translate-x-1/2 bg-accent/60" />
        </div>
      </div>
    </div>
  );
}

export function TimelineLegend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {item(DOT.ON_TIME, "按时")}
      {item(DOT.LATE, "延期提交")}
      {item(DOT.OVERDUE, "逾期未交")}
      {item(DOT.OPEN, "未到期")}
    </div>
  );
}

/* ---------------- 迷你版（只有主节点圆点） ---------------- */

export function TimelineDots({
  projectId,
  items,
  today,
  highlightId,
}: {
  projectId: string;
  items: TrackItem[];
  today: string;
  /** 节点页：高亮当前节点 */
  highlightId?: string;
}) {
  const { groups } = buildTrack(items);
  if (groups.length === 0) return null;
  const flat = groups.flatMap((g) => g.steps);
  // 今天竖线插在第一个“截止日 ≥ 今天”的节点前
  const cut = flat.findIndex((s) => ymdOf(s) >= today);
  const tickBefore = cut === -1 ? null : flat[cut].id;
  const tick = <span key="today" className="mx-0.5 h-4 w-px shrink-0 bg-accent" title="今天" />;
  return (
    <div className="flex flex-wrap items-center gap-y-2" aria-label="交付时间线">
      {groups.map((g, gi) => (
        <span key={g.key} className={`flex items-center ${gi > 0 ? "ml-2" : ""}`} title={g.label}>
          {g.steps.map((s) => (
            <Fragment key={s.id}>
              {s.id === tickBefore ? tick : null}
              <Link href={s.isPlan ? `/pm/projects/${projectId}/timeline#item-${s.id}` : nodeHref(projectId, s)} title={tip(s)} aria-label={tip(s)} className="p-[3px]">
                <span
                  className={`block h-2.5 w-2.5 rounded-full ${DOT[s.score.status]} ${
                    s.id === highlightId ? "ring-2 ring-foreground ring-offset-1" : ""
                  }`}
                />
              </Link>
            </Fragment>
          ))}
        </span>
      ))}
      {tickBefore === null ? tick : null}
    </div>
  );
}
