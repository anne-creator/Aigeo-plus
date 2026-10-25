import type { Deliverable, Project, ProjectKpi, TimelineItem } from "@prisma/client";
import { prisma } from "./db";
import { getRulesConfig } from "./settings";
import { quarterReceiptBasis } from "./compensation-data";
import { kpiStopped } from "./compensation";
import {
  buildSchedule,
  computeBonus,
  quarterScore,
  scheduleKey,
  type BonusResult,
  type DeliverableScore,
  quarterOfDate,
  type QuarterScoreResult,
  type RulesConfig,
  type TimelineItemScore,
} from "./rules";

/**
 * 把规则引擎生成的节点同步到数据库：
 * - 新节点插入；已有节点更新标题/窗口/截止/季度（不动提交记录）；
 * - 不再在计划内（如终止后）且没有任何提交的节点删除。
 * 建档、修改开始日/合同月数/终止日之后都要调用。
 */
export async function syncProjectDeliverables(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const config = await getRulesConfig();
  const schedule = buildSchedule({
    startDate: project.startDate,
    contractMonths: project.contractMonths,
    terminationDate: project.terminationDate,
    config,
  });
  const existing = await prisma.deliverable.findMany({
    where: { projectId },
    include: { _count: { select: { submissions: true } } },
  });
  const byKey = new Map(existing.map((d) => [scheduleKey(d), d]));
  const wanted = new Set(schedule.map(scheduleKey));

  await prisma.$transaction([
    ...schedule.map((s) => {
      const key = scheduleKey(s);
      const data = {
        title: s.title,
        kind: s.kind,
        periodLabel: s.periodLabel,
        quarter: s.quarter,
        windowStart: s.windowStart,
        dueAt: s.dueAt,
      };
      const cur = byKey.get(key);
      return cur
        ? prisma.deliverable.update({ where: { id: cur.id }, data })
        : prisma.deliverable.create({ data: { projectId, code: s.code, seq: s.seq, ...data } });
    }),
    ...existing
      .filter((d) => !wanted.has(scheduleKey(d)) && d._count.submissions === 0)
      .map((d) => prisma.deliverable.delete({ where: { id: d.id } })),
  ]);
}

export type DeliverableWithScore = Deliverable & { score: DeliverableScore };

/** 项目全部节点 + 单项扣分（live 口径） */
export async function getProjectDeliverables(
  projectId: string,
  config?: RulesConfig,
  asOf: Date = new Date(),
): Promise<DeliverableWithScore[]> {
  const cfg = config ?? (await getRulesConfig());
  const items = await prisma.deliverable.findMany({
    where: { projectId },
    orderBy: [{ dueAt: "asc" }, { seq: "asc" }],
  });
  const scored = quarterScore(items, cfg, asOf, "live");
  return scored.details.map((x) => ({ ...x.item, score: x.score }));
}

export type TimelineItemWithScore = TimelineItem & { score: TimelineItemScore };

export interface QuarterSummary {
  quarter: number;
  score: QuarterScoreResult;
  bonus: BonusResult;
  items: DeliverableWithScore[];
  /** 该季度的 timeline 条目（按截止日归属季度）及扣分 */
  timelineItems: TimelineItemWithScore[];
  finalized: boolean;
  actualShowupRate: number | null;
  targetShowupRate: number | null;
  receiptConfirmed: boolean;
}

/** 项目某季度的得分与 KPI 奖测算（live 或 final 口径） */
export async function getQuarterSummary(
  project: Project & { kpis: ProjectKpi[] },
  quarter: number,
  opts: { config?: RulesConfig; asOf?: Date; mode?: "live" | "final" } = {},
): Promise<QuarterSummary> {
  const config = opts.config ?? (await getRulesConfig());
  const asOf = opts.asOf ?? new Date();
  const assessment = await prisma.quarterAssessment.findUnique({
    where: { projectId_quarter: { projectId: project.id, quarter } },
  });
  const mode = opts.mode ?? (assessment?.finalizedAt ? "final" : "live");
  const items = await prisma.deliverable.findMany({
    where: { projectId: project.id, quarter },
    orderBy: [{ dueAt: "asc" }, { seq: "asc" }],
  });
  const allTimeline = await prisma.timelineItem.findMany({
    where: { projectId: project.id },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });
  const timeline = allTimeline.filter((t) => quarterOfDate(project.startDate, t.dueDate) === quarter);
  const score = quarterScore(items, config, asOf, mode, timeline);
  const targetKpi = project.kpis.find((k) => k.metricType === "SHOWUP_RATE");
  const targetShowupRate = assessment?.targetShowupRate ?? targetKpi?.targetValue ?? null;
  const actualShowupRate = assessment?.actualShowupRate ?? null;
  const receiptBasis = await quarterReceiptBasis(project.id, quarter, project.contractMonths);
  const bonus = computeBonus({
    monthlyCommissionCny: receiptBasis.monthlyCommissionCny ?? undefined,
    monthlyFeeUsd: project.monthlyFeeUsd,
    fxRate: assessment?.fxRate ?? config.fxRate,
    commissionRate: config.commissionRate,
    actualShowupRate,
    targetShowupRate,
    deliveryScore: score.score,
  });
  if (assessment?.finalizedAt) {
    bonus.monthlyCommissionCny = assessment.monthlyCommissionCny ?? bonus.monthlyCommissionCny;
    bonus.fullBonusCny = bonus.monthlyCommissionCny;
    bonus.tierPct = (assessment.tierPct ?? bonus.tierPct) as typeof bonus.tierPct;
    bonus.tierBonusCny = bonus.monthlyCommissionCny * bonus.tierPct / 100;
    bonus.kpiBonusCny = assessment.kpiBonusCny ?? bonus.kpiBonusCny;
    bonus.deliveryScorePct = assessment.deliveryScorePct ?? bonus.deliveryScorePct;
    bonus.achievementPct = assessment.achievementPct ?? bonus.achievementPct;
  } else if (kpiStopped(project, quarter) || project.monthlyFeeUsd > 5000) {
    bonus.kpiBonusCny = 0;
  }
  return {
    quarter,
    score,
    bonus,
    items: score.details.map((x) => ({ ...x.item, score: x.score })),
    timelineItems: score.timelineDetails.map((x) => ({ ...x.item, score: x.score })),
    finalized: Boolean(assessment?.finalizedAt),
    actualShowupRate,
    targetShowupRate,
    receiptConfirmed: receiptBasis.complete,
  };
}

/** 项目一共有几个考核季度（按节点归属） */
export async function projectQuarters(projectId: string): Promise<number[]> {
  const rows = await prisma.deliverable.groupBy({ by: ["quarter"], where: { projectId }, orderBy: { quarter: "asc" } });
  return rows.map((r) => r.quarter);
}
