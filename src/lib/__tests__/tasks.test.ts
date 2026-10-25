import { describe, expect, it } from "vitest";
import { parseItemsJson, parseTaskTextByRules } from "@/lib/tasks";

const TODAY = "2026-10-20"; // 周二

describe("parseTaskTextByRules", () => {
  it("日期写在行内任意位置，DDL/截止/前 都能识别并从标题里去掉", () => {
    const text = [
      "任务如下：",
      "1. 剪辑 3 条产品短视频并发布到 YouTube Shorts，DDL 10/25",
      "2、润色 Reddit 帖子 5 篇（截止 10.28）",
      "- 11月3日前 完成第二批博客润色",
      "(4) 整理视频数据表 2026-11-10",
      "调研 10 个 subreddit",
    ].join("\n");
    expect(parseTaskTextByRules(text, TODAY)).toEqual([
      { title: "剪辑 3 条产品短视频并发布到 YouTube Shorts", dueDate: "2026-10-25", note: null, estimatedMinutes: null },
      { title: "润色 Reddit 帖子 5 篇", dueDate: "2026-10-28", note: null, estimatedMinutes: null },
      { title: "完成第二批博客润色", dueDate: "2026-11-03", note: null, estimatedMinutes: null },
      { title: "整理视频数据表", dueDate: "2026-11-10", note: null, estimatedMinutes: null },
      { title: "调研 10 个 subreddit", dueDate: null, note: null, estimatedMinutes: null },
    ]);
  });
  it("相对日期：明天、本周五、下周三", () => {
    const r = parseTaskTextByRules("明天 发布第一条视频\n本周五前 交 2 篇稿\n下周三 媒体排期确认", TODAY);
    expect(r.map((x) => x.dueDate)).toEqual(["2026-10-21", "2026-10-23", "2026-10-28"]);
    expect(r[1].title).toBe("交 2 篇稿");
  });
  it("不把 3.5 篇、v2.1 当成日期；跨年月份取下一年", () => {
    const r = parseTaskTextByRules("写 3.5 篇稿子\n更新 v2.1 版本知识库\n1-08 年后第一批分发", TODAY);
    expect(r.map((x) => x.dueDate)).toEqual([null, null, "2027-01-08"]);
  });
});

describe("parseItemsJson", () => {
  it("过滤非法项并校验日期", () => {
    expect(parseItemsJson('[{"title":" A ","dueDate":"2026-10-30"},{"title":"","dueDate":null},{"title":"B","dueDate":"2026-13-01","note":"x"}]')).toEqual([
      { title: "A", dueDate: "2026-10-30", note: null, estimatedMinutes: null },
      { title: "B", dueDate: null, note: "x", estimatedMinutes: null },
    ]);
    expect(parseItemsJson("oops")).toEqual([]);
  });
});

describe("预计用时", () => {
  it("从任务文字里识别用时并从标题里去掉", () => {
    const r = parseTaskTextByRules("1. 剪辑短视频 3 条，DDL 10/25，约 90 分钟\n2. 润色 2 篇（1.5小时）截止 10.28\n3. 写脚本 2h\n4. 校对 1小时20分\n5. 写 3.5 篇稿子", TODAY);
    expect(r.map((x) => [x.title, x.estimatedMinutes])).toEqual([
      ["剪辑短视频 3 条", 90],
      ["润色 2 篇", 90],
      ["写脚本", 120],
      ["校对", 80],
      ["写 3.5 篇稿子", null],
    ]);
  });
  it("超过 180 分钟按 180 记；clampMinutes 与 formatMinutes", async () => {
    const { clampMinutes, formatMinutes } = await import("@/lib/minutes");
    expect(parseTaskTextByRules("整理全部素材 4 小时", TODAY)[0].estimatedMinutes).toBe(180);
    expect(clampMinutes("200")).toBe(180);
    expect(clampMinutes(-5)).toBe(0);
    expect(clampMinutes("")).toBeNull();
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(90), formatMinutes(120), formatMinutes(null)]).toEqual(["0 分钟", "45 分钟", "1 小时 30 分钟", "2 小时", "未填"]);
  });
});
