import "server-only";
import type { Deliverable, Prisma, Project, ProjectKpi, QuarterAssessment, TimelineItem } from "@prisma/client";
import type { Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getProjectDeliverables,
  getQuarterSummary,
  type DeliverableWithScore,
  type QuarterSummary,
  type TimelineItemWithScore,
} from "@/lib/deliverables";
import { labelOf, PLAN_TIERS, PROJECT_STATUSES, quarterOfDate, scoreTimelineItem, type RulesConfig } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { getTimelineItems, projectProgress, type ProjectProgress } from "@/lib/timeline";
import { formatBj, toBjYmd, weekday, WEEKDAY_CN } from "@/lib/time";

/** PM 端共用：项目查询范围（ADMIN 可看全部） */
export function pmScope(session: Session): Prisma.ProjectWhereInput {
  return session.role === "ADMIN" ? {} : { pmId: session.uid };
}

/** 建档表单里 KPI 行数（第 1 行固定为 ShowUp 率） */
export const KPI_ROWS = 5;

/** 项目仍在交付、可提交材料的状态 */
export const LIVE_STATUSES = ["ACTIVE", "PAUSED"] as const;
export function isLiveStatus(status: string): boolean {
  return (LIVE_STATUSES as readonly string[]).includes(status);
}

export function planTierLabel(v: string): string {
  return labelOf(PLAN_TIERS, v);
}
export function projectStatusLabel(v: string): string {
  return labelOf(PROJECT_STATUSES, v);
}
export function projectStatusTone(v: string): "green" | "amber" | "red" | "zinc" | "neutral" {
  if (v === "ACTIVE") return "green";
  if (v === "PAUSED") return "amber";
  if (v === "TERMINATED") return "red";
  if (v === "COMPLETED") return "zinc";
  return "neutral";
}

export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 北京时间 + 星期，例如 "2026-10-19 23:59（周一）" */
export function formatBjWeekday(d: Date | null | undefined): string {
  if (!d) return "—";
  return `${formatBj(d)}（${WEEKDAY_CN[weekday(toBjYmd(d))]}）`;
}

/** "2026-10-20（周二）" */
export function ymdWeekday(ymd: string): string {
  return `${ymd}（${WEEKDAY_CN[weekday(ymd)]}）`;
}

/** "10-20（周二）"：列表里省掉年份 */
export function shortYmd(ymd: string): string {
  return `${ymd.slice(5)}（${WEEKDAY_CN[weekday(ymd)]}）`;
}

/** 项目总季度数 = ⌈合同月数 / 3⌉，至少 1 */
export function totalQuarters(contractMonths: number): number {
  return Math.max(1, Math.ceil(contractMonths / 3));
}

export interface CurrentQuarter {
  /** 用于取得分的季度（夹在 1 … 总季度数之间） */
  quarter: number;
  /** 原始值：0 = 尚未开始；大于总季度数 = 合同期已过 */
  raw: number;
  label: string;
}

export function currentQuarterOf(project: Pick<Project, "startDate" | "contractMonths">, now: Date): CurrentQuarter {
  const raw = quarterOfDate(project.startDate, toBjYmd(now));
  const max = totalQuarters(project.contractMonths);
  const quarter = Math.min(Math.max(raw, 1), max);
  const label = raw === 0 ? `未开始（第 1 季度）` : raw > max ? `合同期已过（第 ${max} 季度）` : `第 ${quarter} 季度`;
  return { quarter, raw, label };
}

export type PmProject = Project & { kpis: ProjectKpi[]; pm: { id: string; name: string } };

/** 项目已终止且终止日落在该季度（或更早）：按规则当季 KPI 奖不发（与 admin 结算口径一致） */
export function terminatedInQuarter(
  project: Pick<Project, "status" | "startDate" | "terminationDate">,
  quarter: number,
): boolean {
  if (!["PAUSED", "TERMINATED"].includes(project.status) || !project.terminationDate) return false;
  return quarterOfDate(project.startDate, project.terminationDate) <= quarter;
}

/** PM 端展示用的季度摘要：已结算季度带固化结算单，并应用终止季 KPI 奖不发的规则 */
export interface PmQuarterSummary extends QuarterSummary {
  /** 已结算时为固化的结算单（admin「结算并固化」写入），未结算为 null */
  assessment: QuarterAssessment | null;
  terminatedHere: boolean;
  /** 展示口径：已结算取固化数字；终止季 KPI 奖为 0；其余为实时测算 */
  display: {
    scorePct: number;
    achievementPct: number | null;
    tierPct: number;
    monthlyCommissionCny: number;
    kpiBonusCny: number;
    fxRate: number;
  };
}

export async function loadQuarterSummary(
  project: PmProject,
  quarter: number,
  config: RulesConfig,
  now: Date,
): Promise<PmQuarterSummary> {
  const summary = await getQuarterSummary(project, quarter, { config, asOf: now });
  const stored = summary.finalized
    ? await prisma.quarterAssessment.findUnique({ where: { projectId_quarter: { projectId: project.id, quarter } } })
    : null;
  const assessment = stored?.finalizedAt ? stored : null;
  const terminatedHere = terminatedInQuarter(project, quarter);
  const { score, bonus } = summary;
  const display = assessment
    ? {
        scorePct: assessment.deliveryScorePct ?? score.scorePct,
        achievementPct: assessment.achievementPct ?? bonus.achievementPct,
        tierPct: assessment.tierPct ?? bonus.tierPct,
        monthlyCommissionCny: assessment.monthlyCommissionCny ?? bonus.monthlyCommissionCny,
        kpiBonusCny: assessment.kpiBonusCny ?? (terminatedHere ? 0 : bonus.kpiBonusCny),
        fxRate: assessment.fxRate,
      }
    : {
        scorePct: score.scorePct,
        achievementPct: bonus.achievementPct,
        tierPct: bonus.tierPct,
        monthlyCommissionCny: bonus.monthlyCommissionCny,
        kpiBonusCny: terminatedHere ? 0 : bonus.kpiBonusCny,
        fxRate: config.fxRate,
      };
  return { ...summary, assessment, terminatedHere, display };
}

/* ---------------- 项目 timeline 条目 ---------------- */

/** 项目的 timeline 条目 + 单条扣分（live 口径），按截止日排序 */
export async function loadTimeline(projectId: string, config: RulesConfig, now: Date): Promise<TimelineItemWithScore[]> {
  const items = await getTimelineItems(projectId);
  return items.map((t) => ({ ...t, score: scoreTimelineItem(t, config, now) }));
}

/** 规则 4.2b：PM 只能改/删“截止日未到且未完成”的条目；ADMIN 不限 */
/** timeline 首次录入后，项目经理改日期/删条目都要走“修改申请”由管理员审批；只有管理员能直接改 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canEditTimelineItem(session: Session, _item: Pick<TimelineItem, "dueDate" | "completedAt">, _today: string): boolean {
  return session.role === "ADMIN";
}

/** 撤销勾选：PM 只能撤销当天勾选的；ADMIN 不限 */
export function canUndoTimelineItem(session: Session, item: Pick<TimelineItem, "completedAt">, today: string): boolean {
  if (!item.completedAt) return false;
  if (session.role === "ADMIN") return true;
  return toBjYmd(item.completedAt) === today;
}

/** 未完成且已过截止（含宽限期内）：与 projectProgress.overdueItems 同口径 */
export function isLateTimelineItem(t: TimelineItemWithScore): boolean {
  return t.score.status === "GRACE" || t.score.status === "OVERDUE";
}

export interface NextStep {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  href: string;
}

/** “下一步”：系统节点与 timeline 条目里，截止日 ≥ 今天且未完成的最早一条 */
export function nextStepOf(
  projectId: string,
  items: Array<Pick<Deliverable, "id" | "kind" | "title" | "dueAt" | "firstSubmittedAt">>,
  timeline: Array<Pick<TimelineItem, "title" | "dueDate" | "completedAt">>,
  today: string,
): NextStep | null {
  const cands: NextStep[] = [
    ...items.filter((d) => !d.firstSubmittedAt).map((d) => ({ title: d.title, date: toBjYmd(d.dueAt), href: nodeHref(projectId, d) })),
    ...timeline.filter((t) => !t.completedAt).map((t) => ({ title: t.title, date: t.dueDate, href: timelineHref(projectId) })),
  ].filter((c) => c.date >= today);
  cands.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return cands[0] ?? null;
}

export interface PmProjectOverview {
  project: PmProject;
  items: DeliverableWithScore[];
  timeline: TimelineItemWithScore[];
  progress: ProjectProgress;
  next: NextStep | null;
  current: CurrentQuarter;
  summary: PmQuarterSummary;
  /** 已过截止未提交的系统节点 */
  overdue: DeliverableWithScore[];
  /** 已过截止未完成的 timeline 条目（含宽限期内） */
  timelineLate: TimelineItemWithScore[];
  rejected: DeliverableWithScore[];
}

/** 一个项目的全部节点 + timeline 条目 + 进度 + 当前季度测算 + 待办分组 */
export async function buildOverview(project: PmProject, config: RulesConfig, now: Date): Promise<PmProjectOverview> {
  const [items, timeline] = await Promise.all([getProjectDeliverables(project.id, config, now), loadTimeline(project.id, config, now)]);
  const current = currentQuarterOf(project, now);
  const summary = await loadQuarterSummary(project, current.quarter, config, now);
  const byDue = (a: DeliverableWithScore, b: DeliverableWithScore) => a.dueAt.getTime() - b.dueAt.getTime();
  const today = toBjYmd(now);
  return {
    project,
    items,
    timeline,
    progress: projectProgress(project, items, timeline, now),
    next: nextStepOf(project.id, items, timeline, today),
    current,
    summary,
    overdue: items.filter((d) => d.score.status === "OVERDUE").sort(byDue),
    timelineLate: timeline.filter(isLateTimelineItem),
    rejected: items.filter((d) => d.reviewStatus === "REJECTED").sort(byDue),
  };
}

/** 当前 PM（或 ADMIN）名下的项目及其概览 */
export async function loadPmProjects(
  session: Session,
  opts: { statuses?: readonly string[]; now?: Date } = {},
): Promise<{ overviews: PmProjectOverview[]; config: RulesConfig; now: Date }> {
  const now = opts.now ?? new Date();
  const config = await getRulesConfig();
  const projects = await prisma.project.findMany({
    where: { ...pmScope(session), ...(opts.statuses ? { status: { in: [...opts.statuses] } } : {}) },
    include: { kpis: true, pm: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  const overviews: PmProjectOverview[] = [];
  for (const p of projects) overviews.push(await buildOverview(p, config, now));
  return { overviews, config, now };
}

/** 单个项目（含 KPI 与 PM），不校验权限——调用方用 canAccessProject */
export async function loadPmProject(id: string): Promise<PmProject | null> {
  return prisma.project.findUnique({
    where: { id },
    include: { kpis: true, pm: { select: { id: true, name: true } } },
  });
}

/** 读取 searchParams 里的单个字符串 */
export function sp(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function deliverableHref(projectId: string, deliverableId: string): string {
  return `/pm/projects/${projectId}/deliverables/${deliverableId}`;
}
export function projectHref(projectId: string): string {
  return `/pm/projects/${projectId}`;
}
export function timelineHref(projectId: string): string {
  return `/pm/projects/${projectId}/timeline`;
}
/** 节点去处：PROJECT_TIMELINE 节点直接进 timeline 页，其余进节点页 */
export function nodeHref(projectId: string, d: Pick<Deliverable, "id" | "kind">): string {
  return d.kind === "TIMELINE" ? timelineHref(projectId) : deliverableHref(projectId, d.id);
}
