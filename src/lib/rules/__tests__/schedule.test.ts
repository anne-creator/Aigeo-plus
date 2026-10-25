import { describe, expect, it } from "vitest";
import { buildSchedule, firstWeeklyUpdateDate, projectEndDate, quarterOfDate } from "../schedule";
import { diffDays, endOfDayBj, startOfDayBj } from "@/lib/time";

const byCode = (items: ReturnType<typeof buildSchedule>, code: string) => items.filter((i) => i.code === code);

describe("buildSchedule — 2026-09-21（周一）起、3 个月", () => {
  const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 3 });

  it("生成 5 个一次性节点 + 12 次周报 + 3 月报 + 3 分发清单 + 1 季报", () => {
    expect(byCode(items, "PROMPT_POOL")).toHaveLength(1);
    expect(byCode(items, "PROJECT_TIMELINE")).toHaveLength(1);
    expect(byCode(items, "BASELINE_PLAN")).toHaveLength(1);
    expect(byCode(items, "SITE_CHECKLIST")).toHaveLength(1);
    expect(byCode(items, "KNOWLEDGE_BASE")).toHaveLength(1);
    expect(byCode(items, "WEEKLY_UPDATE")).toHaveLength(12);
    expect(byCode(items, "MONTHLY_REPORT")).toHaveLength(3);
    expect(byCode(items, "DISTRIBUTION_LIST")).toHaveLength(3);
    expect(byCode(items, "QUARTER_REPORT")).toHaveLength(1);
    expect(items).toHaveLength(24);
  });

  it("提示词池第 1 天截止，基线报告第 1 周结束截止，官网 checklist / 知识库第 2–3 周", () => {
    expect(byCode(items, "PROMPT_POOL")[0]).toMatchObject({ windowStartYmd: "2026-09-21", dueYmd: "2026-09-21" });
    expect(byCode(items, "BASELINE_PLAN")[0]).toMatchObject({ windowStartYmd: "2026-09-21", dueYmd: "2026-09-27" });
    expect(byCode(items, "SITE_CHECKLIST")[0]).toMatchObject({ windowStartYmd: "2026-09-21", dueYmd: "2026-10-11" });
    expect(byCode(items, "KNOWLEDGE_BASE")[0]).toMatchObject({ windowStartYmd: "2026-09-21", dueYmd: "2026-10-11" });
    // 项目 timeline：第 2 周结束前首次上传，窗口从 D0 开放
    expect(byCode(items, "PROJECT_TIMELINE")[0]).toMatchObject({ kind: "TIMELINE", windowStartYmd: "2026-09-21", dueYmd: "2026-10-04", quarter: 1 });
  });

  it("截止时刻是北京时间 23:59:59.999", () => {
    const p = byCode(items, "PROMPT_POOL")[0];
    expect(p.dueAt.toISOString()).toBe("2026-09-21T15:59:59.999Z");
    expect(p.windowStart.toISOString()).toBe("2026-09-20T16:00:00.000Z");
    expect(endOfDayBj("2026-09-21").getTime()).toBe(p.dueAt.getTime());
    expect(startOfDayBj("2026-09-21").getTime()).toBe(p.windowStart.getTime());
  });

  it("周报从 D0+7 起的第一个周一开始，每周一，直到项目结束日", () => {
    const weeks = byCode(items, "WEEKLY_UPDATE").map((w) => w.dueYmd);
    expect(weeks[0]).toBe("2026-09-28");
    expect(weeks[weeks.length - 1]).toBe("2026-12-14");
    expect(projectEndDate("2026-09-21", 3)).toBe("2026-12-19");
    // 所有节点从 D0 起开放，可以跳步提交
    expect(items.every((w) => w.windowStartYmd === "2026-09-21")).toBe(true);
    expect(diffDays("2026-09-23", "2026-09-21")).toBe(2);
    expect(byCode(items, "WEEKLY_UPDATE").every((w) => w.quarter === 1)).toBe(true);
  });

  it("月报/分发清单：每 30 天结束后 7 天内截止（D0+30M+6）", () => {
    const m = byCode(items, "MONTHLY_REPORT");
    expect(m.map((x) => [x.seq, x.dueYmd])).toEqual([
      [1, "2026-10-27"],
      [2, "2026-11-26"],
      [3, "2026-12-26"],
    ]);
    const d = byCode(items, "DISTRIBUTION_LIST");
    expect(d.map((x) => x.dueYmd)).toEqual(m.map((x) => x.dueYmd));
    expect(m.every((x) => x.quarter === 1)).toBe(true);
  });

  it("季末报告：季度结束后 7 天内，归属该季度", () => {
    const q = byCode(items, "QUARTER_REPORT");
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ seq: 1, dueYmd: "2026-12-26", quarter: 1 });
  });

  it("按截止时间排序", () => {
    for (let i = 1; i < items.length; i++) {
      expect(items[i].dueAt.getTime()).toBeGreaterThanOrEqual(items[i - 1].dueAt.getTime());
    }
  });
});

describe("首次周报日期", () => {
  it.each([
    ["2026-09-21", "2026-09-28"], // 周一 → 下周一
    ["2026-09-22", "2026-10-05"], // 周二 → D0+7 是周二，下一个周一
    ["2026-09-23", "2026-10-05"], // 周三
    ["2026-09-26", "2026-10-05"], // 周六
    ["2026-09-20", "2026-09-28"], // 周日 → D0+7 是周日，次日周一
  ])("%s 开始 → 首次周报 %s", (start, expected) => {
    expect(firstWeeklyUpdateDate(start)).toBe(expected);
  });
});

describe("合同月数与季度归属", () => {
  it("1 个月：只有 1 份月报，没有季报，周报到 D0+29 为止", () => {
    const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 1 });
    expect(byCode(items, "MONTHLY_REPORT")).toHaveLength(1);
    expect(byCode(items, "QUARTER_REPORT")).toHaveLength(0);
    const weeks = byCode(items, "WEEKLY_UPDATE").map((w) => w.dueYmd);
    expect(weeks).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  });

  it("4 个月：第 4 个月月报归第 2 季度，只有 1 份季报", () => {
    const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 4 });
    const m4 = byCode(items, "MONTHLY_REPORT").find((x) => x.seq === 4)!;
    expect(m4.quarter).toBe(2);
    expect(byCode(items, "QUARTER_REPORT")).toHaveLength(1);
    const lateWeeks = byCode(items, "WEEKLY_UPDATE").filter((w) => w.quarter === 2);
    expect(lateWeeks.length).toBeGreaterThan(0);
    expect(lateWeeks[0].dueYmd >= "2026-12-20").toBe(true);
  });

  it("6 个月：2 份季报，第 2 季度窗口从 D0+180 开始", () => {
    const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 6 });
    const q = byCode(items, "QUARTER_REPORT");
    expect(q.map((x) => [x.seq, x.dueYmd, x.quarter])).toEqual([
      [1, "2026-12-26", 1],
      [2, "2027-03-26", 2],
    ]);
  });

  it("quarterOfDate：D0+89 属 Q1，D0+90 属 Q2", () => {
    expect(quarterOfDate("2026-09-21", "2026-12-19")).toBe(1);
    expect(quarterOfDate("2026-09-21", "2026-12-20")).toBe(2);
    expect(quarterOfDate("2026-09-21", "2026-09-20")).toBe(0);
  });

  it("月数非法时返回空", () => {
    expect(buildSchedule({ startDate: "2026-09-21", contractMonths: 0 })).toEqual([]);
  });
});

describe("终止", () => {
  it("截止日晚于终止日的节点不再生成", () => {
    const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 3, terminationDate: "2026-10-15" });
    expect(items.every((i) => i.dueYmd <= "2026-10-15")).toBe(true);
    expect(byCode(items, "SITE_CHECKLIST")).toHaveLength(1); // 10-11 截止，保留
    expect(byCode(items, "WEEKLY_UPDATE").map((w) => w.dueYmd)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(byCode(items, "MONTHLY_REPORT")).toHaveLength(0);
  });
});

describe("窗口天数可配置", () => {
  it("月报窗口改为 10 天", () => {
    const items = buildSchedule({
      startDate: "2026-09-21",
      contractMonths: 3,
      config: { monthlyReportWindowDays: 10, quarterReportWindowDays: 14 },
    });
    expect(byCode(items, "MONTHLY_REPORT")[0].dueYmd).toBe("2026-10-30");
    expect(byCode(items, "QUARTER_REPORT")[0].dueYmd).toBe("2027-01-02");
  });
});

describe("建议项节点（默认关闭）", () => {
  it("默认不生成续约推进计划和新季度规划", () => {
    const items = buildSchedule({ startDate: "2026-09-21", contractMonths: 6 });
    expect(byCode(items, "RENEWAL_PLAN")).toHaveLength(0);
    expect(byCode(items, "QUARTER_PLAN")).toHaveLength(0);
  });
  it("启用后：续约推进计划在结束前 30 天截止；新季度规划从第 2 季起", () => {
    const items = buildSchedule({
      startDate: "2026-09-21",
      contractMonths: 6,
      config: { deliverables: { RENEWAL_PLAN: { enabled: true }, QUARTER_PLAN: { enabled: true } } },
    });
    const r = byCode(items, "RENEWAL_PLAN");
    expect(r).toHaveLength(1);
    // 结束日 D0+179 = 2027-03-19，结束前 30 天 = 2027-02-17
    expect(r[0]).toMatchObject({ dueYmd: "2027-02-17", quarter: 2 });
    const qp = byCode(items, "QUARTER_PLAN");
    expect(qp.map((x) => [x.seq, x.dueYmd, x.quarter])).toEqual([[2, "2026-12-26", 2]]);
  });
  it("可以关闭标准节点（如周一复盘）", () => {
    const items = buildSchedule({
      startDate: "2026-09-21",
      contractMonths: 3,
      config: { deliverables: { WEEKLY_UPDATE: { enabled: false } } },
    });
    expect(byCode(items, "WEEKLY_UPDATE")).toHaveLength(0);
  });
});

describe("isYmd", () => {
  it("拒绝进位日期", async () => {
    const { isYmd } = await import("@/lib/time");
    expect(isYmd("2026-13-40")).toBe(false);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-02-28")).toBe(true);
    expect(isYmd("2026-2-8")).toBe(false);
  });
});
