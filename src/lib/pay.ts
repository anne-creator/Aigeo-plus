/**
 * 收入测算（《项目经理薪酬规则》）：底薪 + 月提成 + 季度 KPI 奖 + 续约奖，以及每一笔扣分对应少拿多少钱。
 * 所有金额为人民币、到手口径；实际回款按服务月记录；未录回款时只显示合同估算。
 */
import { COMMISSION_RATE, SALARY_TIERS, salaryForHours, commissionFromReceipt, commissionEligible, currentServiceMonth, servicePeriod, kpiStopped, renewalWithinWindow, occurredBeforeDeparture } from "./compensation";
import { prisma } from "./db";
import { getQuarterSummary } from "./deliverables";
import { projectEndDate, quarterOfDate, round2, type RulesConfig } from "./rules";
import { getRulesConfig } from "./settings";
import { weekStartOf, weeklyWorkFor } from "./tasks";
import { addDays, diffDays, endOfDayBj, startOfDayBj, toBjYmd } from "./time";

/* ---------------- 底薪（PDF：按当月日均有效工作时间分档） ---------------- */

export const BASE_SALARY_TIERS = SALARY_TIERS;
export const baseSalaryByHours = salaryForHours;

export function monthlyCommission(monthlyFeeUsd: number, cfg: Pick<RulesConfig, "fxRate">): number {
  return commissionFromReceipt(monthlyFeeUsd * cfg.fxRate);
}

/* ---------------- 项目经理收入 ---------------- */

export type DeductionKind = "LATE" | "AI" | "REVIEW" | "TIMELINE";

export interface DeductionImpact {
  kind: DeductionKind;
  title: string;
  reason: string;
  /** 少拿的钱（按当前档位假设） */
  lostCny: number;
  /** 未提交还在增加 */
  growing: boolean;
  href: string;
}

export interface UpcomingImpact {
  title: string;
  dueDate: string;
  /** 每晚交一天少拿多少 */
  perDayCny: number;
  href: string;
}

export interface ServiceMonthPay {
  month: number;
  start: string;
  end: string;
  receivedCny: number | null;
  commissionCny: number | null;
  estimatedCny: number | null;
  eligible: boolean;
  current: boolean;
  note: string | null;
}

export interface ProjectPay {
  projectId: string;
  clientName: string;
  monthlyFeeUsd: number;
  commissionCny: number;
  estimatedCommissionCny: number;
  confirmedCommissionCny: number | null;
  receivedCny: number | null;
  serviceMonth: number | null;
  serviceStart: string | null;
  serviceEnd: string | null;
  incomeStatus: string;
  custom: boolean;
  ledger: ServiceMonthPay[];
  bonusStatus: string;
  bonusPending: boolean;
  monthlyWithKpiCny: number | null;
  monthlyFullScenarioCny: number | null;
  quarter: number;
  deliveryScorePct: number;
  /** 效果未知时档位不确定，数值记为 0，界面显示待确认。 */
  tierPct: number;
  tierAssumed: boolean;
  fullBonusCny: number;
  projectedBonusCny: number;
  lostCny: number;
  deductions: DeductionImpact[];
  upcoming: UpcomingImpact[];
}

export interface RenewalPay {
  projectId: string;
  clientName: string;
  months: number;
  bonusCny: number;
  /** 独立的新一期续约结束日；缺少日期时待确认。 */
  periodEnd: string | null;
  periodStart: string | null;
  signedDate: string | null;
  servedPaidMonths: number | null;
  receivedCny: number | null;
  status: string;
  estimated: boolean;
  /** 续约期已结束，可在下一个发薪日发放 */
  payable: boolean;
  paidAt: Date | null;
}

/** 续约奖 = 月提成 × 续约月数 ÷ 3（每续约 3 个月奖 1 个月提成） */
export function renewalBonus(monthlyFeeUsd: number, months: number, cfg: Pick<RulesConfig, "fxRate">): number {
  return round2((monthlyFeeUsd * cfg.fxRate * COMMISSION_RATE * months) / 3);
}

export interface PmPay {
  month: string;
  base: { salary: number; label: string; source: "HOURS" | "PENDING"; avgDailyHours: number | null };
  activeProjects: number;
  commissionTotal: number;
  confirmedCommissionTotal: number;
  pendingReceiptCount: number;
  customProjectCount: number;
  departedOn: string | null;
  /** 本月固定收入 = 底薪 + 月提成合计 */
  monthlyFixed: number;
  projects: ProjectPay[];
  bonusFull: number;
  bonusProjected: number;
  bonusLost: number;
  /** 其中 AI 审核不通过扣掉的 */
  aiLost: number;
  /** 其中晚交、超期扣掉的 */
  lateLost: number;
  renewals: RenewalPay[];
  renewalTotal: number;
  fxRate: number;
}

export async function getPmPay(pmId: string, now: Date = new Date()): Promise<PmPay> {
  const cfg = await getRulesConfig();
  const today = toBjYmd(now);
  const month = today.slice(0, 7);
  const [projects, hours, pm] = await Promise.all([
    prisma.project.findMany({ where: { pmId }, include: { kpis: true, serviceReceipts: true, assessments: true }, orderBy: { startDate: "asc" } }),
    prisma.monthlyHours.findUnique({ where: { userId_month: { userId: pmId, month } } }),
    prisma.user.findUniqueOrThrow({ where: { id: pmId }, select: { departedOn: true } }),
  ]);

  const base = hours
    ? { ...baseSalaryByHours(hours.avgDailyHours), source: "HOURS" as const, avgDailyHours: hours.avgDailyHours }
    : { salary: 0, label: "待录入当月工作日平均有效工时", source: "PENDING" as const, avgDailyHours: null };

  const out: ProjectPay[] = [];
  for (const p of projects) {
    const custom = p.monthlyFeeUsd > 5000;
    const serviceMonth = currentServiceMonth(p, today);
    const ledger: ServiceMonthPay[] = Array.from({ length: p.contractMonths }, (_, i) => {
      const m = i + 1;
      const receipt = p.serviceReceipts.find((r) => r.serviceMonth === m);
      const eligible = commissionEligible(p, m) && occurredBeforeDeparture(p.startDate, m, pm.departedOn);
      return { month: m, ...servicePeriod(p.startDate, m), receivedCny: receipt?.receivedCny ?? null,
        commissionCny: !eligible ? 0 : custom || !receipt ? null : commissionFromReceipt(receipt.receivedCny),
        estimatedCny: custom ? null : eligible ? monthlyCommission(p.monthlyFeeUsd, cfg) : 0,
        eligible, current: m === serviceMonth, note: receipt?.note ?? null };
    });
    const current = ledger.find((l) => l.current);
    const eligible = Boolean(current?.eligible);
    const estimatedCommission = current?.estimatedCny ?? 0;
    const confirmedCommission = custom ? null : !eligible ? 0 : current?.commissionCny ?? null;
    const commission = confirmedCommission ?? estimatedCommission;
    const incomeStatus = custom ? "大额项目 · 待单独约定" : !serviceMonth ? today < p.startDate ? "合同服务尚未开始" : "合同服务期已结束" : !eligible ? "下个服务月起已停发" : confirmedCommission === null ? "待确认回款 · 合同估算" : current?.receivedCny === 0 ? "本服务月未回款" : "已按实际回款核算";
    const maxQ = Math.max(1, Math.ceil(p.contractMonths / 3));
    const quarter = Math.min(maxQ, Math.max(1, quarterOfDate(p.startDate, today)));
    const s = await getQuarterSummary(p, quarter, { config: cfg, asOf: now });
    const tierAssumed = s.bonus.achievementPct === null;
    const tierPct = s.bonus.tierPct;
    const finalized = p.assessments.find((a) => a.quarter === quarter && a.finalizedAt);
    const stopped = !finalized && (kpiStopped(p, quarter) || Boolean(pm.departedOn));
    const bonusPending = !stopped && !finalized && (tierAssumed || custom);
    const bonusBase = custom ? 0 : finalized?.monthlyCommissionCny ?? s.bonus.monthlyCommissionCny;
    const pot = stopped ? 0 : (bonusBase * (finalized?.tierPct ?? tierPct)) / 100;
    const bonusStatus = stopped ? "暂停、终止或离职 · 未结奖金停发" : custom ? "大额项目另行约定" : finalized ? "已结算 · 下个发薪日发放" : tierAssumed ? "待录入效果，奖金尚未确定" : "按当前效果预计 · 待季度审核与回款确认";
    const totalWeight = s.score.totalWeight;
    const perPoint = totalWeight > 0 ? pot / totalWeight : 0;
    const href = (id: string) => `/pm/projects/${p.id}/deliverables/${id}`;

    const deductions: DeductionImpact[] = [];
    for (const it of s.items) {
      const sc = it.score;
      if (!sc.counted || sc.totalDeduction <= 0) continue;
      // 晚交与审核扣分合计封顶在权重内：按比例分摊到两种原因
      const raw = sc.lateDeduction + sc.reviewDeduction;
      const k = raw > 0 ? sc.totalDeduction / raw : 0;
      const link = it.kind === "TIMELINE" ? `/pm/projects/${p.id}/timeline` : href(it.id);
      if (sc.lateDeduction > 0) {
        deductions.push({
          kind: "LATE",
          title: it.title,
          reason: sc.lateDays < 0 ? "未提交，按扣满计" : it.firstSubmittedAt ? `晚交 ${sc.lateDays} 天` : `已逾期 ${sc.lateDays} 天未交`,
          lostCny: round2(perPoint * sc.lateDeduction * k),
          growing: sc.projected && sc.lateDays >= 0,
          href: link,
        });
      }
      if (sc.reviewDeduction > 0) {
        const ai = it.reviewSource === "AI";
        deductions.push({
          kind: ai ? "AI" : "REVIEW",
          title: it.title,
          reason: ai ? `AI 审核不通过，扣该项 ${sc.reviewPct}%` : `管理员审核不通过，扣该项 ${sc.reviewPct}%`,
          lostCny: round2(perPoint * sc.reviewDeduction * k),
          growing: false,
          href: link,
        });
      }
    }
    for (const t of s.timelineItems) {
      if (!t.score.counted || t.score.deduction <= 0) continue;
      deductions.push({
        kind: "TIMELINE",
        title: `timeline：${t.title}`,
        reason: t.completedAt ? `迟完成 ${t.score.lateDays} 天（宽限 ${t.score.graceDays} 天后计）` : `超期 ${t.score.lateDays} 天未完成`,
        lostCny: round2(perPoint * t.score.deduction),
        growing: !t.completedAt,
        href: `/pm/projects/${p.id}/timeline`,
      });
    }
    deductions.sort((a, b) => b.lostCny - a.lostCny);

    // 接下来 14 天要交的：每晚一天少拿多少
    const upcoming: UpcomingImpact[] = s.items
      .filter((it) => !it.firstSubmittedAt && it.score.status === "OPEN" && it.dueAt.getTime() <= endOfDayBj(addDays(today, 14)).getTime())
      .map((it) => {
        const w = it.score.weight;
        const denom = totalWeight + w; // 到期后会计入分母
        const perDay = denom > 0 ? (pot * ((w * it.score.penaltyPerDayPct) / 100)) / denom : 0;
        return { title: it.title, dueDate: toBjYmd(it.dueAt), perDayCny: round2(perDay), href: href(it.id) };
      })
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
      .slice(0, 5);

    const projected = stopped ? 0 : finalized?.kpiBonusCny ?? round2(pot * s.score.score);
    out.push({
      projectId: p.id,
      clientName: p.clientName,
      monthlyFeeUsd: p.monthlyFeeUsd,
      commissionCny: commission,
      estimatedCommissionCny: estimatedCommission,
      confirmedCommissionCny: confirmedCommission,
      receivedCny: current?.receivedCny ?? null,
      serviceMonth,
      serviceStart: current?.start ?? null,
      serviceEnd: current?.end ?? null,
      incomeStatus, custom, ledger, bonusStatus, bonusPending,
      monthlyWithKpiCny: bonusPending || custom || !eligible ? null : round2(commission + projected / 3),
      monthlyFullScenarioCny: custom || !eligible || stopped ? null : round2(monthlyCommission(p.monthlyFeeUsd, cfg) * 5 / 3),
      quarter,
      deliveryScorePct: finalized?.deliveryScorePct ?? s.score.scorePct,
      tierPct,
      tierAssumed,
      fullBonusCny: bonusBase,
      projectedBonusCny: projected,
      lostCny: Math.max(0, round2(pot - projected)),
      deductions,
      upcoming,
    });
  }

  const commissionTotal = round2(out.reduce((a, p) => a + p.commissionCny, 0));
  const sumKind = (kinds: DeductionKind[]) => round2(out.reduce((a, p) => a + p.deductions.filter((d) => kinds.includes(d.kind)).reduce((b, d) => b + d.lostCny, 0), 0));

  const renewals: RenewalPay[] = projects.filter((p) => p.renewalStatus === "RENEWED" && (p.renewalMonths ?? 0) > 0).map((r) => {
    const months = r.renewalMonths!;
    const originalEnd = projectEndDate(r.startDate, r.contractMonths);
    const scheduledEnd = r.renewalStartDate ? projectEndDate(r.renewalStartDate, months) : null;
    const end = scheduledEnd && r.terminationDate && r.terminationDate >= r.renewalStartDate! && r.terminationDate < scheduledEnd ? r.terminationDate : scheduledEnd;
    const eligible = r.renewalSignedDate && renewalWithinWindow(originalEnd, r.renewalSignedDate);
    const actual = r.renewalServedPaidMonths !== null && r.renewalReceivedCny !== null;
    const completedMonths = r.renewalStartDate ? Math.max(0, Math.min(months, Math.floor((diffDays(end && end < today ? end : addDays(today, -1), r.renewalStartDate) + 1) / 30))) : 0;
    const validActual = actual && r.renewalServedPaidMonths! <= completedMonths && r.renewalServedPaidMonths! > 0 && r.renewalReceivedCny! > 0;
    const custom = r.monthlyFeeUsd > 5000;
    const canceled = Boolean(pm.departedOn) || (r.renewalSignedDate && !eligible);
    const referenceAmount = actual ? round2(r.renewalReceivedCny! * COMMISSION_RATE / 3) : renewalBonus(r.monthlyFeeUsd, months, cfg);
    const amount = custom || canceled ? 0 : referenceAmount;
    const payable = Boolean(!canceled && !custom && eligible && end && end < today && validActual);
    const status = r.renewalPaidAt ? "已发放" : pm.departedOn ? "离职 · 未结续约奖停发" : custom ? "大额项目另行约定" : !r.renewalSignedDate || !r.renewalStartDate ? "待确认续约签约日、服务期" : !eligible ? "超过上期结束后 90 天 · 不符合续约奖" : !end || end >= today ? "续约期未结束" : !validActual ? "待核实实际服务并回款的月数和金额" : "待下一个发薪日发放";
    return { projectId: r.id, clientName: r.clientName, months, bonusCny: r.renewalPaidAt ? r.renewalPaidCny ?? referenceAmount : amount, periodEnd: end,
      periodStart: r.renewalStartDate, signedDate: r.renewalSignedDate,
      servedPaidMonths: r.renewalServedPaidMonths, receivedCny: r.renewalReceivedCny,
      estimated: !actual, status, payable, paidAt: r.renewalPaidAt };
  });

  return {
    month,
    base,
    activeProjects: out.filter((p) => p.serviceMonth !== null && p.ledger.some((l) => l.current && l.eligible)).length,
    commissionTotal,
    confirmedCommissionTotal: round2(out.reduce((a, p) => a + (p.confirmedCommissionCny ?? 0), 0)),
    pendingReceiptCount: out.filter((p) => !p.custom && p.confirmedCommissionCny === null).length,
    customProjectCount: out.filter((p) => p.custom).length,
    departedOn: pm.departedOn,
    monthlyFixed: round2(base.salary + commissionTotal),
    projects: out,
    bonusFull: round2(out.reduce((a, p) => a + p.fullBonusCny, 0)),
    bonusProjected: round2(out.reduce((a, p) => a + p.projectedBonusCny, 0)),
    bonusLost: round2(out.reduce((a, p) => a + p.lostCny, 0)),
    aiLost: sumKind(["AI"]),
    lateLost: sumKind(["LATE", "TIMELINE"]),
    renewals,
    renewalTotal: round2(renewals.filter((r) => !r.paidAt).reduce((a, r) => a + r.bonusCny, 0)),
    fxRate: cfg.fxRate,
  };
}

/* ---------------- 负责人工作量 ---------------- */

export interface AssigneeWork {
  weekMinutes: number;
  monthMinutes: number;
  /** 最近 6 周（旧到新），每周完成任务的预计用时 */
  weeks: Array<{ weekStart: string; minutes: number }>;
  doneCount: number;
  onTimeCount: number;
  lateDoneCount: number;
  overdueOpen: number;
  openCount: number;
  /** 按时完成率 0–100；没有完成的任务时为 null */
  onTimePct: number | null;
}

export async function getAssigneeWork(userId: string, now: Date = new Date()): Promise<AssigneeWork> {
  const today = toBjYmd(now);
  const thisWeek = weekStartOf(today);
  const firstWeek = addDays(thisWeek, -35);
  const tasks = await prisma.internTask.findMany({ where: { assigneeId: userId }, select: { status: true, dueAt: true, completedAt: true, estimatedMinutes: true } });
  const weeks = Array.from({ length: 6 }, (_, i) => ({ weekStart: addDays(firstWeek, i * 7), minutes: 0 }));
  let monthMinutes = 0;
  let done = 0;
  let onTime = 0;
  let lateDone = 0;
  let overdueOpen = 0;
  let open = 0;
  for (const t of tasks) {
    if (t.status === "DONE" && t.completedAt) {
      done += 1;
      if (!t.dueAt || t.completedAt.getTime() <= t.dueAt.getTime()) onTime += 1;
      else lateDone += 1;
      const ymd = toBjYmd(t.completedAt);
      const m = t.estimatedMinutes ?? 0;
      if (ymd.slice(0, 7) === today.slice(0, 7)) monthMinutes += m;
      if (ymd >= firstWeek) {
        const idx = Math.floor((startOfDayBj(weekStartOf(ymd)).getTime() - startOfDayBj(firstWeek).getTime()) / (7 * 86_400_000));
        if (idx >= 0 && idx < weeks.length) weeks[idx].minutes += m;
      }
    } else {
      open += 1;
      if (t.dueAt && t.dueAt.getTime() < now.getTime()) overdueOpen += 1;
    }
  }
  const week = (await weeklyWorkFor([userId], now)).get(userId)!;
  return {
    weekMinutes: week.totalMinutes,
    monthMinutes,
    weeks,
    doneCount: done,
    onTimeCount: onTime,
    lateDoneCount: lateDone,
    overdueOpen,
    openCount: open,
    onTimePct: done ? Math.round((onTime / done) * 100) : null,
  };
}

/* ---------------- 管理员：薪酬平台 ---------------- */

export interface PmPerformance {
  /** 本季已计入的节点：按时 / 晚交 / 逾期未交 */
  onTime: number;
  late: number;
  overdue: number;
  /** 按时率 0–100；没有计入节点时为 null */
  onTimePct: number | null;
  aiReviewed: number;
  aiFailed: number;
  /** 最新一次 AI 审核分的平均值 */
  aiAvgScore: number | null;
}

export interface PayrollRow {
  pm: { id: string; name: string; username: string };
  pay: PmPay;
  perf: PmPerformance;
}

export async function getPayroll(now: Date = new Date()): Promise<PayrollRow[]> {
  const pms = await prisma.user.findMany({ where: { role: "PM" }, select: { id: true, name: true, username: true }, orderBy: { name: "asc" } });
  const rows: PayrollRow[] = [];
  for (const pm of pms) {
    const pay = await getPmPay(pm.id, now);
    rows.push({ pm, pay, perf: await pmPerformance(pm.id, pay, now) });
  }
  return rows;
}

async function pmPerformance(pmId: string, pay: PmPay, now: Date): Promise<PmPerformance> {
  const cfg = await getRulesConfig();
  let onTime = 0;
  let late = 0;
  let overdue = 0;
  for (const pp of pay.projects) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: pp.projectId }, include: { kpis: true } });
    const s = await getQuarterSummary(project, pp.quarter, { config: cfg, asOf: now });
    for (const it of s.items) {
      if (!it.score.counted) continue;
      if (it.score.status === "ON_TIME") onTime += 1;
      else if (it.score.status === "LATE") late += 1;
      else if (it.score.status === "OVERDUE") overdue += 1;
    }
  }
  const reviews = await prisma.aiReview.findMany({
    where: { deliverable: { project: { pmId } }, verdict: { in: ["PASS", "FAIL"] } },
    orderBy: { createdAt: "desc" },
    select: { deliverableId: true, score: true, verdict: true },
  });
  const latest = new Map<string, { score: number | null; verdict: string }>();
  for (const r of reviews) if (!latest.has(r.deliverableId)) latest.set(r.deliverableId, r);
  const scores = [...latest.values()].map((r) => r.score).filter((x): x is number => x !== null);
  const counted = onTime + late + overdue;
  return {
    onTime,
    late,
    overdue,
    onTimePct: counted ? Math.round((onTime / counted) * 100) : null,
    aiReviewed: latest.size,
    aiFailed: [...latest.values()].filter((r) => r.verdict === "FAIL").length,
    aiAvgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

export interface AiDeductionLog {
  id: string;
  createdAt: Date;
  pmName: string;
  clientName: string;
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
  score: number | null;
  verdict: string;
  deductionPct: number;
  summary: string;
  /** 这次审核是否仍是该材料的当前结论（之后重交或被管理员改判则为 false） */
  current: boolean;
}

/** 最近的 AI 审核记录（管理员面板展示 AI 自动执行的扣除） */
export async function recentAiReviews(limit = 30): Promise<AiDeductionLog[]> {
  const rows = await prisma.aiReview.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      deliverable: {
        include: {
          project: { include: { pm: { select: { name: true } } } },
          submissions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    pmName: r.deliverable.project.pm.name,
    clientName: r.deliverable.project.clientName,
    projectId: r.deliverable.projectId,
    deliverableId: r.deliverableId,
    deliverableTitle: r.deliverable.title,
    score: r.score,
    verdict: r.verdict,
    deductionPct: r.deductionPct,
    summary: r.summary,
    current: r.deliverable.reviewSource === "AI" && r.deliverable.submissions[0]?.id === r.submissionId,
  }));
}
