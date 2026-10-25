import { describe, expect, it } from "vitest";
import { parseTimelineText, projectProgress } from "@/lib/timeline";
import { endOfDayBj, startOfDayBj } from "@/lib/time";

describe("parseTimelineText", () => {
  it("识别多种日期写法，不带年份时取不早于开始日的年份", () => {
    const text = `10-15 提交 Reddit 内容\n10/20 提交第二批博客\n10.25，官网 FAQ 上线\n2026-11-02 月报初稿\n11月10日 客户复盘会\n1-05 下季度规划\n\n- 12.01: 季末报告准备`;
    const { items, errors } = parseTimelineText(text, "2026-09-21");
    expect(errors).toEqual([]);
    expect(items.map((i) => [i.dueDate, i.title])).toEqual([
      ["2026-10-15", "提交 Reddit 内容"],
      ["2026-10-20", "提交第二批博客"],
      ["2026-10-25", "官网 FAQ 上线"],
      ["2026-11-02", "月报初稿"],
      ["2026-11-10", "客户复盘会"],
      ["2027-01-05", "下季度规划"],
      ["2026-12-01", "季末报告准备"],
    ]);
  });
  it("报告无法解析的行", () => {
    const { items, errors } = parseTimelineText("提交 Reddit 内容\n10-15\n02-30 不存在的日期", "2026-09-21");
    expect(items).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([1, 2, 3]);
  });
});

describe("projectProgress", () => {
  it("按条目数算完成进度，按天数算时间进度", () => {
    const now = startOfDayBj("2026-10-20");
    const p = projectProgress(
      { startDate: "2026-09-21", contractMonths: 3, terminationDate: null },
      [
        { dueAt: endOfDayBj("2026-09-21"), firstSubmittedAt: now },
        { dueAt: endOfDayBj("2026-10-11"), firstSubmittedAt: null },
        { dueAt: endOfDayBj("2026-12-26"), firstSubmittedAt: null },
      ],
      [
        { dueDate: "2026-10-15", completedAt: now },
        { dueDate: "2026-10-20", completedAt: null },
      ],
      now,
    );
    expect(p).toMatchObject({ dayIndex: 30, totalDays: 90, timePct: 33, totalItems: 5, doneItems: 2, donePct: 40, overdueItems: 1, dueSoFar: 4, doneSoFar: 2 });
  });
});

describe("diffTimeline", () => {
  const cur = [
    { id: "a", dueDate: "2026-10-15", title: "提交 Reddit 内容", completedAt: new Date() },
    { id: "b", dueDate: "2026-10-20", title: "第二批博客", completedAt: null },
    { id: "c", dueDate: "2026-10-25", title: "官网 FAQ 上线", completedAt: null },
    { id: "d", dueDate: "2026-11-01", title: "月报发送", completedAt: null },
  ];
  it("对应同名条目：改期、删除、新增；已完成的保留且不重复新增", async () => {
    const { diffTimeline, diffSummary } = await import("@/lib/timeline");
    const d = diffTimeline(cur, [
      { dueDate: "2026-10-15", title: "提交 Reddit 内容" },
      { dueDate: "2026-10-22", title: "第二批 博客" },
      { dueDate: "2026-11-01", title: "月报发送" },
      { dueDate: "2026-11-05", title: "Quora 回答 5 条" },
    ]);
    expect(d.moved).toEqual([{ id: "b", title: "第二批博客", from: "2026-10-20", to: "2026-10-22" }]);
    expect(d.removed.map((r) => r.id)).toEqual(["c"]);
    expect(d.added).toEqual([{ dueDate: "2026-11-05", title: "Quora 回答 5 条" }]);
    expect(d.unchanged).toBe(1);
    expect(d.keptDone).toBe(1);
    expect(diffSummary(d)).toBe("新增 1 · 删除 1 · 改期 1");
  });
  it("timelineToText 只导出未完成条目", async () => {
    const { timelineToText } = await import("@/lib/timeline");
    expect(timelineToText(cur)).toBe("2026-10-20 第二批博客\n2026-10-25 官网 FAQ 上线\n2026-11-01 月报发送");
  });
});
