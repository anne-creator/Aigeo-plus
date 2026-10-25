import { prisma } from "./db";
import { DEFAULT_RULES, DELIVERABLE_CODES, type RulesConfig } from "./rules";

const KEY = "rules";

function mergeRules(stored: Partial<RulesConfig> | null | undefined): RulesConfig {
  const deliverables = { ...DEFAULT_RULES.deliverables };
  for (const code of DELIVERABLE_CODES) {
    const s = stored?.deliverables?.[code];
    if (s) deliverables[code] = { ...deliverables[code], ...s, enabled: s.enabled ?? deliverables[code].enabled ?? true };
  }
  return {
    aiReview: {
      ...DEFAULT_RULES.aiReview,
      ...(stored?.aiReview ?? {}),
      bands: stored?.aiReview?.bands?.length ? stored.aiReview.bands : DEFAULT_RULES.aiReview.bands,
    },
    fxRate: stored?.fxRate ?? DEFAULT_RULES.fxRate,
    timeline: { ...DEFAULT_RULES.timeline, ...(stored?.timeline ?? {}) },
    // 薪酬规则固定 10%；历史配置不能悄悄改变标准项目的提成。
    commissionRate: DEFAULT_RULES.commissionRate,
    reviewRejectDeductionPct: stored?.reviewRejectDeductionPct ?? DEFAULT_RULES.reviewRejectDeductionPct,
    monthlyReportWindowDays: stored?.monthlyReportWindowDays ?? DEFAULT_RULES.monthlyReportWindowDays,
    quarterReportWindowDays: stored?.quarterReportWindowDays ?? DEFAULT_RULES.quarterReportWindowDays,
    deliverables,
  };
}

/** 读取规则配置（存储值与默认值合并） */
export async function getRulesConfig(): Promise<RulesConfig> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return mergeRules(null);
  try {
    return mergeRules(JSON.parse(row.value) as Partial<RulesConfig>);
  } catch {
    return mergeRules(null);
  }
}

export async function saveRulesConfig(next: RulesConfig): Promise<void> {
  const value = JSON.stringify(mergeRules(next));
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
