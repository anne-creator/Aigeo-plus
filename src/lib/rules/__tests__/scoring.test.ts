import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../defaults";
import { achievementPct, computeBonus, deliverableStatus, quarterScore, scoreDeliverable, scoreTimelineItem, tierPct } from "../scoring";
import { endOfDayBj, lateDays, startOfDayBj } from "@/lib/time";

const due = endOfDayBj("2026-09-21"); // 2026-09-21T15:59:59.999Z
const open = startOfDayBj("2026-09-21");
const base = { code: "PROMPT_POOL", quarter: 1, windowStart: open, dueAt: due, reviewStatus: "NONE", reviewDeductionPct: null };

describe("延期天数", () => {
  it("截止前提交 = 0", () => {
    expect(lateDays(due, new Date(due.getTime() - 1))).toBe(0);
    expect(lateDays(due, due)).toBe(0);
  });
  it("截止后 1 毫秒 = 1 天；第二天 23:59:59.999 仍为 1 天；第三天 00:00 = 2 天", () => {
    expect(lateDays(due, new Date(due.getTime() + 1))).toBe(1);
    expect(lateDays(due, endOfDayBj("2026-09-22"))).toBe(1);
    expect(lateDays(due, startOfDayBj("2026-09-23"))).toBe(2);
  });
});

describe("节点状态", () => {
  const now = new Date("2026-09-21T10:00:00Z");
  it("待提交 / 已逾期 / 按时 / 延期（没有“未开放”，开始前也能提交）", () => {
    expect(deliverableStatus({ ...base, firstSubmittedAt: null }, startOfDayBj("2026-09-20"))).toBe("OPEN");
    expect(deliverableStatus({ ...base, firstSubmittedAt: null }, now)).toBe("OPEN");
    expect(deliverableStatus({ ...base, firstSubmittedAt: null }, new Date(due.getTime() + 1))).toBe("OVERDUE");
    expect(deliverableStatus({ ...base, firstSubmittedAt: now }, new Date())).toBe("ON_TIME");
    expect(deliverableStatus({ ...base, firstSubmittedAt: new Date(due.getTime() + 1) }, new Date())).toBe("LATE");
  });
});

describe("单项扣分", () => {
  it("按时提交不扣分", () => {
    const s = scoreDeliverable({ ...base, firstSubmittedAt: due }, DEFAULT_RULES, new Date());
    expect(s).toMatchObject({ status: "ON_TIME", weight: 10, lateDays: 0, latePct: 0, totalDeduction: 0, counted: true });
  });
  it("延期 3 天、日扣 10% → 扣 30%", () => {
    const s = scoreDeliverable({ ...base, firstSubmittedAt: startOfDayBj("2026-09-24") }, DEFAULT_RULES, new Date());
    expect(s.lateDays).toBe(3);
    expect(s.latePct).toBe(30);
    expect(s.lateDeduction).toBe(3);
    expect(s.totalDeduction).toBe(3);
  });
  it("延期 15 天封顶 100%", () => {
    const s = scoreDeliverable({ ...base, firstSubmittedAt: startOfDayBj("2026-10-07") }, DEFAULT_RULES, new Date());
    expect(s.latePct).toBe(100);
    expect(s.totalDeduction).toBe(10);
  });
  it("周报日扣 20%，延期 5 天扣满", () => {
    const s = scoreDeliverable(
      { ...base, code: "WEEKLY_UPDATE", firstSubmittedAt: startOfDayBj("2026-09-26") },
      DEFAULT_RULES,
      new Date(),
    );
    expect(s.lateDays).toBe(5);
    expect(s.latePct).toBe(100);
    expect(s.totalDeduction).toBe(2);
  });
  it("审核不通过默认再扣 50%，可按项覆盖；合计不超过权重", () => {
    const rejected = scoreDeliverable({ ...base, firstSubmittedAt: due, reviewStatus: "REJECTED" }, DEFAULT_RULES, new Date());
    expect(rejected.reviewPct).toBe(50);
    expect(rejected.totalDeduction).toBe(5);
    const custom = scoreDeliverable(
      { ...base, firstSubmittedAt: due, reviewStatus: "REJECTED", reviewDeductionPct: 20 },
      DEFAULT_RULES,
      new Date(),
    );
    expect(custom.totalDeduction).toBe(2);
    const both = scoreDeliverable(
      { ...base, firstSubmittedAt: startOfDayBj("2026-09-29"), reviewStatus: "REJECTED" }, // 延期 8 天 80% + 审核 50%
      DEFAULT_RULES,
      new Date(),
    );
    expect(both.totalDeduction).toBe(10);
  });
  it("未提交且已逾期：live 口径按截至目前天数预估，final 口径扣 100%", () => {
    const asOf = startOfDayBj("2026-09-24");
    const live = scoreDeliverable({ ...base, firstSubmittedAt: null }, DEFAULT_RULES, asOf, "live");
    expect(live).toMatchObject({ status: "OVERDUE", lateDays: 3, latePct: 30, counted: true, projected: true });
    const fin = scoreDeliverable({ ...base, firstSubmittedAt: null }, DEFAULT_RULES, asOf, "final");
    expect(fin).toMatchObject({ latePct: 100, totalDeduction: 10, counted: true, projected: true });
  });
  it("未到期且未提交：live 不计入，final 扣 100%", () => {
    const asOf = new Date("2026-09-21T02:00:00Z");
    expect(scoreDeliverable({ ...base, firstSubmittedAt: null }, DEFAULT_RULES, asOf, "live").counted).toBe(false);
    const fin = scoreDeliverable({ ...base, firstSubmittedAt: null }, DEFAULT_RULES, asOf, "final");
    expect(fin.counted).toBe(true);
    expect(fin.totalDeduction).toBe(10);
  });
});

describe("季度交付得分", () => {
  it("= 1 − Σ扣分 ÷ Σ权重，只统计计入节点", () => {
    const items = [
      { ...base, firstSubmittedAt: due }, // 10 分，不扣
      { ...base, code: "BASELINE_PLAN", dueAt: endOfDayBj("2026-09-27"), firstSubmittedAt: startOfDayBj("2026-09-29") }, // 15 分，延期 2 天扣 3
      { ...base, code: "SITE_CHECKLIST", windowStart: startOfDayBj("2026-09-28"), dueAt: endOfDayBj("2026-10-11"), firstSubmittedAt: null }, // 未到期不计
    ];
    const r = quarterScore(items, DEFAULT_RULES, new Date("2026-10-01T00:00:00Z"));
    expect(r.totalWeight).toBe(25);
    expect(r.totalDeduction).toBe(3);
    expect(r.scorePct).toBe(88);
    expect(r.countedItems).toBe(2);
    expect(r.totalItems).toBe(3);
  });
  it("没有计入节点时得分 100%", () => {
    expect(quarterScore([], DEFAULT_RULES, new Date()).score).toBe(1);
  });
});

describe("效果达成率与档位（PDF 原文）", () => {
  it("目标 50%，做到 65% = 130% → 满奖", () => {
    expect(achievementPct(65, 50)).toBe(130);
    expect(tierPct(130)).toBe(100);
  });
  it("100%–130% → 60%；低于 100% 不发", () => {
    expect(tierPct(129.99)).toBe(60);
    expect(tierPct(100)).toBe(60);
    expect(tierPct(99.99)).toBe(0);
    expect(tierPct(null)).toBe(0);
  });
  it("目标为 0 或缺失时无法计算", () => {
    expect(achievementPct(50, 0)).toBeNull();
  });
});

describe("季度 KPI 奖（PDF 示例数字）", () => {
  it("$2,000 项目：月提成 ¥1,360；达成 100–130% 发 60% = ¥816", () => {
    const r = computeBonus({ monthlyFeeUsd: 2000, fxRate: 6.8, commissionRate: 0.1, actualShowupRate: 55, targetShowupRate: 50, deliveryScore: 1 });
    expect(r.monthlyCommissionCny).toBe(1360);
    expect(r.achievementPct).toBe(110);
    expect(r.tierPct).toBe(60);
    expect(r.kpiBonusCny).toBe(816);
  });
  it("$3,300 项目：月提成 ¥2,244；满奖 ¥2,244；60% 档 ¥1,346.4", () => {
    const full = computeBonus({ monthlyFeeUsd: 3300, fxRate: 6.8, commissionRate: 0.1, actualShowupRate: 65, targetShowupRate: 50, deliveryScore: 1 });
    expect(full.monthlyCommissionCny).toBe(2244);
    expect(full.kpiBonusCny).toBe(2244);
    const sixty = computeBonus({ monthlyFeeUsd: 3300, fxRate: 6.8, commissionRate: 0.1, actualShowupRate: 50, targetShowupRate: 50, deliveryScore: 1 });
    expect(sixty.kpiBonusCny).toBe(1346.4);
  });
  it("交付得分 88% 时按比例扣：¥2,244 × 88% = ¥1,974.72", () => {
    const r = computeBonus({ monthlyFeeUsd: 3300, fxRate: 6.8, commissionRate: 0.1, actualShowupRate: 70, targetShowupRate: 50, deliveryScore: 0.88 });
    expect(r.kpiBonusCny).toBe(1974.72);
  });
  it("效果未录入时奖金为 0 但仍给出月提成", () => {
    const r = computeBonus({ monthlyFeeUsd: 2000, fxRate: 6.8, commissionRate: 0.1, actualShowupRate: null, targetShowupRate: 50, deliveryScore: 1 });
    expect(r.achievementPct).toBeNull();
    expect(r.kpiBonusCny).toBe(0);
    expect(r.monthlyCommissionCny).toBe(1360);
  });
});

describe("timeline 条目：超期一周后开始扣分", () => {
  const item = (dueDate: string, completedAt: Date | null) => ({ dueDate, completedAt });
  it("按时或宽限期内完成不扣分", () => {
    expect(scoreTimelineItem(item("2026-10-15", startOfDayBj("2026-10-15")), DEFAULT_RULES, new Date())).toMatchObject({ status: "DONE", lateDays: 0, deduction: 0 });
    expect(scoreTimelineItem(item("2026-10-15", startOfDayBj("2026-10-22")), DEFAULT_RULES, new Date())).toMatchObject({ status: "DONE", lateDays: 7, penaltyDays: 0, deduction: 0 });
  });
  it("超期 10 天完成：宽限 7 天后按 3 天扣 30%", () => {
    const s = scoreTimelineItem(item("2026-10-15", startOfDayBj("2026-10-25")), DEFAULT_RULES, new Date());
    expect(s).toMatchObject({ lateDays: 10, penaltyDays: 3, latePct: 30, deduction: 0.3 });
  });
  it("超期 17 天及以上扣满", () => {
    const s = scoreTimelineItem(item("2026-10-15", startOfDayBj("2026-11-05")), DEFAULT_RULES, new Date());
    expect(s.latePct).toBe(100);
    expect(s.deduction).toBe(1);
  });
  it("未完成：未到期不计；宽限期内计入但扣 0；超出宽限按截至目前预估；结算口径扣 100%", () => {
    expect(scoreTimelineItem(item("2026-10-15", null), DEFAULT_RULES, startOfDayBj("2026-10-10")).counted).toBe(false);
    const grace = scoreTimelineItem(item("2026-10-15", null), DEFAULT_RULES, startOfDayBj("2026-10-20"));
    expect(grace).toMatchObject({ status: "GRACE", counted: true, deduction: 0, projected: true });
    const over = scoreTimelineItem(item("2026-10-15", null), DEFAULT_RULES, startOfDayBj("2026-10-27"));
    expect(over).toMatchObject({ status: "OVERDUE", lateDays: 12, penaltyDays: 5, latePct: 50, deduction: 0.5 });
    expect(scoreTimelineItem(item("2026-10-15", null), DEFAULT_RULES, startOfDayBj("2026-10-10"), "final")).toMatchObject({ counted: true, deduction: 1 });
  });
  it("季度得分把 timeline 条目一起算进分母", () => {
    const r = quarterScore(
      [{ ...base, firstSubmittedAt: due }],
      DEFAULT_RULES,
      startOfDayBj("2026-11-01"),
      "live",
      [item("2026-10-15", startOfDayBj("2026-10-25")), item("2026-10-20", startOfDayBj("2026-10-20")), item("2026-12-01", null)],
    );
    expect(r.totalWeight).toBe(12); // 10 + 1 + 1（12-01 未到期不计）
    expect(r.totalDeduction).toBe(0.3);
    expect(r.countedItems).toBe(3);
    expect(r.totalItems).toBe(4);
  });
});
