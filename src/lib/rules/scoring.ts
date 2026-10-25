import { endOfDayBj, lateDays as calcLateDays } from "@/lib/time";
import type { DeliverableCode, DeliverableStatus, ReviewStatus, RulesConfig, TierPct, TimelineStatus } from "./types";

export interface DeliverableLike {
  code: DeliverableCode | string;
  quarter: number;
  windowStart: Date;
  dueAt: Date;
  firstSubmittedAt: Date | null;
  reviewStatus: ReviewStatus | string;
  reviewDeductionPct: number | null;
}

export interface DeliverableScore {
  status: DeliverableStatus;
  weight: number;
  penaltyPerDayPct: number;
  /** 延期天数（已提交：按首次提交；未提交且已逾期：按截至 asOf 的天数） */
  lateDays: number;
  /** 延期扣分比例 0–100 */
  latePct: number;
  lateDeduction: number;
  /** 审核不通过扣分比例 0–100 */
  reviewPct: number;
  reviewDeduction: number;
  /** 合计扣分（不超过权重） */
  totalDeduction: number;
  /** 是否计入季度得分（未到期且未提交的不计） */
  counted: boolean;
  /** 未提交时为 true：扣分是“截至目前的预估”，还会继续增加 */
  projected: boolean;
}

export function deliverableStatus(
  d: Pick<DeliverableLike, "windowStart" | "dueAt" | "firstSubmittedAt">,
  now: Date,
): DeliverableStatus {
  if (d.firstSubmittedAt) return d.firstSubmittedAt.getTime() <= d.dueAt.getTime() ? "ON_TIME" : "LATE";
  // 所有节点从项目第 1 天起都开放，可以提前、跳步提交；只看截止
  if (now.getTime() <= d.dueAt.getTime()) return "OPEN";
  return "OVERDUE";
}

function clampPct(p: number): number {
  return Math.max(0, Math.min(100, p));
}

/**
 * 单项扣分。
 * mode = "live"：未提交且已逾期的，按截至 asOf 的逾期天数预估；
 * mode = "final"：结算口径，未提交的一律扣 100%。
 */
export function scoreDeliverable(
  d: DeliverableLike,
  config: RulesConfig,
  asOf: Date,
  mode: "live" | "final" = "live",
): DeliverableScore {
  const typeCfg = config.deliverables[d.code as DeliverableCode] ?? { weight: 0, penaltyPerDayPct: 0 };
  const weight = typeCfg.weight;
  const status = deliverableStatus(d, asOf);

  let late = 0;
  let counted = true;
  let projected = false;
  if (d.firstSubmittedAt) {
    late = calcLateDays(d.dueAt, d.firstSubmittedAt);
  } else if (status === "OVERDUE") {
    projected = true;
    late = mode === "final" ? Number.POSITIVE_INFINITY : calcLateDays(d.dueAt, asOf);
  } else {
    // 未到期也未提交：不计入
    counted = mode === "final" ? true : false;
    if (mode === "final") {
      projected = true;
      late = Number.POSITIVE_INFINITY;
    }
  }

  const latePct = late === Number.POSITIVE_INFINITY ? 100 : clampPct(late * typeCfg.penaltyPerDayPct);
  const lateDeduction = (weight * latePct) / 100;

  let reviewPct = 0;
  if (d.reviewStatus === "REJECTED") {
    reviewPct = clampPct(d.reviewDeductionPct ?? config.reviewRejectDeductionPct);
  }
  const reviewDeduction = (weight * reviewPct) / 100;

  const totalDeduction = Math.min(weight, lateDeduction + reviewDeduction);

  return {
    status,
    weight,
    penaltyPerDayPct: typeCfg.penaltyPerDayPct,
    lateDays: late === Number.POSITIVE_INFINITY ? -1 : late,
    latePct,
    lateDeduction: round2(lateDeduction),
    reviewPct,
    reviewDeduction: round2(reviewDeduction),
    totalDeduction: round2(totalDeduction),
    counted,
    projected,
  };
}

/* ---------------- timeline 条目 ---------------- */

export interface TimelineItemLike {
  dueDate: string; // YYYY-MM-DD
  completedAt: Date | null;
}

export interface TimelineItemScore {
  status: TimelineStatus;
  weight: number;
  graceDays: number;
  /** 超过截止日的天数（已完成：按完成时间；未完成：按 asOf） */
  lateDays: number;
  /** 扣除宽限后的延期天数 */
  penaltyDays: number;
  latePct: number;
  deduction: number;
  counted: boolean;
  projected: boolean;
}

export function timelineItemStatus(item: TimelineItemLike, graceDays: number, asOf: Date): TimelineStatus {
  if (item.completedAt) return "DONE";
  const late = calcLateDays(endOfDayBj(item.dueDate), asOf);
  if (late === 0) return "TODO";
  return late <= graceDays ? "GRACE" : "OVERDUE";
}

/**
 * timeline 条目扣分：超过截止日 graceDays 天仍未完成才开始扣，之后每天扣权重的 penaltyPerDayPct，封顶 100%。
 * live：未完成且已过截止的按截至 asOf 预估；final：未完成的一律扣 100%。
 */
export function scoreTimelineItem(
  item: TimelineItemLike,
  config: RulesConfig,
  asOf: Date,
  mode: "live" | "final" = "live",
): TimelineItemScore {
  const { weight, graceDays, penaltyPerDayPct } = config.timeline;
  const status = timelineItemStatus(item, graceDays, asOf);
  const due = endOfDayBj(item.dueDate);
  let late = 0;
  let counted = true;
  let projected = false;
  if (item.completedAt) {
    late = calcLateDays(due, item.completedAt);
  } else if (mode === "final") {
    projected = true;
    late = Number.POSITIVE_INFINITY;
  } else if (status === "TODO") {
    counted = false;
  } else {
    projected = true;
    late = calcLateDays(due, asOf);
  }
  const penaltyDays = late === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, late - graceDays);
  const latePct = penaltyDays === Number.POSITIVE_INFINITY ? 100 : clampPct(penaltyDays * penaltyPerDayPct);
  return {
    status,
    weight,
    graceDays,
    lateDays: late === Number.POSITIVE_INFINITY ? -1 : late,
    penaltyDays: penaltyDays === Number.POSITIVE_INFINITY ? -1 : penaltyDays,
    latePct,
    deduction: round2((weight * latePct) / 100),
    counted,
    projected,
  };
}

export interface QuarterScoreResult {
  /** 0–1 */
  score: number;
  /** 0–100 */
  scorePct: number;
  totalWeight: number;
  totalDeduction: number;
  countedItems: number;
  totalItems: number;
}

/**
 * 季度交付得分 = 1 − Σ扣分 ÷ Σ权重（只统计计入的节点）。
 * 没有任何计入节点时得分为 100%。
 */
export function quarterScore<T extends DeliverableLike, U extends TimelineItemLike = TimelineItemLike>(
  items: T[],
  config: RulesConfig,
  asOf: Date,
  mode: "live" | "final" = "live",
  timelineItems: U[] = [],
): QuarterScoreResult & {
  details: Array<{ item: T; score: DeliverableScore }>;
  timelineDetails: Array<{ item: U; score: TimelineItemScore }>;
} {
  const details = items.map((item) => ({ item, score: scoreDeliverable(item, config, asOf, mode) }));
  const timelineDetails = timelineItems.map((item) => ({ item, score: scoreTimelineItem(item, config, asOf, mode) }));
  const counted = details.filter((x) => x.score.counted);
  const countedTimeline = timelineDetails.filter((x) => x.score.counted);
  const totalWeight =
    counted.reduce((s, x) => s + x.score.weight, 0) + countedTimeline.reduce((s, x) => s + x.score.weight, 0);
  const totalDeduction =
    counted.reduce((s, x) => s + x.score.totalDeduction, 0) + countedTimeline.reduce((s, x) => s + x.score.deduction, 0);
  const score = totalWeight === 0 ? 1 : Math.max(0, Math.min(1, 1 - totalDeduction / totalWeight));
  return {
    score,
    scorePct: round2(score * 100),
    totalWeight: round2(totalWeight),
    totalDeduction: round2(totalDeduction),
    countedItems: counted.length + countedTimeline.length,
    totalItems: items.length + timelineItems.length,
    details,
    timelineDetails,
  };
}

/** 效果达成率（%）= 实际 ShowUp 率 ÷ 合同目标 × 100 */
export function achievementPct(actualShowupRate: number, targetShowupRate: number): number | null {
  if (!(targetShowupRate > 0) || !(actualShowupRate >= 0)) return null;
  return round2((actualShowupRate / targetShowupRate) * 100);
}

/** 档位系数：≥130% → 100%；100%–130%（不含）→ 60%；<100% → 0 */
export function tierPct(achievement: number | null): TierPct {
  if (achievement === null || Number.isNaN(achievement)) return 0;
  if (achievement >= 130) return 100;
  if (achievement >= 100) return 60;
  return 0;
}

export interface BonusInput {
  /** 有完整实际回款时，使用本季度实际月提成平均值。 */
  monthlyCommissionCny?: number;
  monthlyFeeUsd: number;
  fxRate: number;
  commissionRate: number;
  actualShowupRate: number | null;
  targetShowupRate: number | null;
  /** 0–1 */
  deliveryScore: number;
}

export interface BonusResult {
  monthlyCommissionCny: number;
  achievementPct: number | null;
  tierPct: TierPct;
  deliveryScorePct: number;
  /** 满奖（= 1 个月提成） */
  fullBonusCny: number;
  /** 按档位 */
  tierBonusCny: number;
  /** 按档位再按交付得分 */
  kpiBonusCny: number;
}

/** 季度 KPI 奖 = 月提成 × 档位系数 × 季度交付得分 */
export function computeBonus(input: BonusInput): BonusResult {
  const monthlyCommissionCny = input.monthlyCommissionCny ?? round2(input.monthlyFeeUsd * input.fxRate * input.commissionRate);
  const ach =
    input.actualShowupRate === null || input.targetShowupRate === null
      ? null
      : achievementPct(input.actualShowupRate, input.targetShowupRate);
  const tier = tierPct(ach);
  const tierBonusCny = round2((monthlyCommissionCny * tier) / 100);
  const kpiBonusCny = round2(tierBonusCny * input.deliveryScore);
  return {
    monthlyCommissionCny,
    achievementPct: ach,
    tierPct: tier,
    deliveryScorePct: round2(input.deliveryScore * 100),
    fullBonusCny: monthlyCommissionCny,
    tierBonusCny,
    kpiBonusCny,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
