import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { findTimelineDates, normalizeTimelineDraft, parseTimelineDraft, validateTimelineRows, verifyTimelineEvidence } from "@/lib/timeline-import";
import { csvTimelineText, organizeTimelineDocument, readTimelineDocument } from "@/lib/timeline-document";
import { mergeTimelineGroups } from "@/lib/timeline-track";

const context = { startDate: "2026-10-01", endDate: "2026-12-29" };
const fixtures = new URL("./fixtures/", import.meta.url);
const file = async (name: string) => new File([await readFile(new URL(name, fixtures))], name);
afterEach(() => vi.unstubAllEnvs());

describe("timeline 日期与节点提取", () => {
  it("按列名读取不同列序，保留 readiness 和发布批次", () => {
    const result = parseTimelineDraft("发布日期\t事项\t备注\n2026-11-02\tReadiness 发布\t准备报告\n2026-11-09\tReddit 第一波发布\t3 篇\n2026-11-23\tReddit 第二波发布\t5 篇", context);
    expect(result.items.map((i) => [i.dueDate, i.title])).toEqual([
      ["2026-11-02", "Readiness 发布"], ["2026-11-09", "Reddit 第一波发布"], ["2026-11-23", "Reddit 第二波发布"],
    ]);
    expect(result.items[2].source).toContain("5 篇");
  });
  it("识别行内中文、英文、相对项目日期，并标记推定年份", () => {
    const r = parseTimelineDraft("Readiness 发布 11月2日\nReddit wave 1 Nov 9, 2026\nD+21 第二波发布\n第30天 复盘", context);
    expect(r.items.map((i) => i.dueDate)).toEqual(["2026-11-02", "2026-11-09", "2026-10-22", "2026-10-30"]);
    expect(r.items[0].warning).toContain("年份");
  });
  it("跨年依据服务周期，不把任意旧日期推到下一年", () => {
    expect(findTimelineDates("1月5日", { startDate: "2026-12-01", endDate: "2027-02-28" })[0].date).toBe("2027-01-05");
    expect(findTimelineDates("9月5日", context)[0].date).toBeNull();
    expect(findTimelineDates("11月5日", { startDate: "2026-10-01", endDate: "2027-12-29" })[0].date).toBeNull();
  });
  it("不猜测范围、多日期、无日期、相对今天、无效日期", () => {
    const r = parseTimelineDraft("2026-11-02 至 2026-11-09 第二波\n11/02-11/09 范围节点\nReadiness 待定\n下周五 首波\n2026-02-30 第三波", context);
    expect(r.items.every((i) => i.dueDate === null && i.warning)).toBe(true);
  });
  it("日期标题可以覆盖后面的多条任务", () => {
    const r = parseTimelineDraft("2026-11-02\n- Readiness 发布\n- 第一波发布", context);
    expect(r.items.map((i) => i.dueDate)).toEqual(["2026-11-02", "2026-11-02"]);
    expect(r.items[0].warning).toContain("上方日期");
  });
  it("不把版本号、数量小数识别成日期", () => {
    expect(findTimelineDates("更新 v2.1，准备 3.5 篇", context)).toEqual([]);
  });
  it("去重但保留不同批次，拒绝超大结果", () => {
    const r = parseTimelineDraft("2026-11-02 第一波\n2026-11-02 第一波\n2026-11-02 第二波", context);
    expect(r.items).toHaveLength(2);
    expect(r.warnings).toHaveLength(1);
    expect(() => normalizeTimelineDraft(Array.from({ length: 201 }, (_, i) => ({ title: String(i), dueDate: null, source: "", warning: null })), context)).toThrow("200");
  });
  it("核实 AI 原文依据，无依据的日期不能直接确认", () => {
    const result = verifyTimelineEvidence([{ title: "第二波", dueDate: "2026-11-23", source: "不存在的内容", warning: null }], "第一波 2026-11-09");
    expect(result[0].dueDate).toBeNull();
    expect(result[0].warning).toContain("未能在原文核实");
  });
  it("服务端拒绝缺项、无效日期、过长标题，保存时去重和排序", () => {
    expect(validateTimelineRows(["2026-02-30"], ["发布"], context.startDate).ok).toBe(false);
    expect(validateTimelineRows([""], ["发布"], context.startDate).ok).toBe(false);
    expect(validateTimelineRows(["2026-11-02"], ["字".repeat(201)], context.startDate).ok).toBe(false);
    expect(validateTimelineRows(["2026-11-02"], [], context.startDate).ok).toBe(false);
    expect(validateTimelineRows(["2026-11-09", "2026-11-02", "2026-11-02"], ["第二波", "第一波", "第一波"], context.startDate)).toEqual({ ok: true, items: [{ dueDate: "2026-11-02", title: "第一波" }, { dueDate: "2026-11-09", title: "第二波" }] });
  });
});

describe("真实文件基础提取", () => {
  it("Word 表格保留列和日期对应关系", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const r = await organizeTimelineDocument(await file("timeline-table.docx"), context);
    expect(r.method).toBe("rules");
    expect(r.items.map((i) => [i.title, i.dueDate])).toEqual([
      ["Readiness 发布", "2026-11-02"], ["Reddit 第一波发布", "2026-11-09"], ["Reddit 第二波发布", "2026-11-23"],
    ]);
  });
  it("PDF 表格的事项与日期按同一行关联", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const r = await organizeTimelineDocument(await file("timeline-table.pdf"), context);
    expect(r.items.map((i) => [i.title, i.dueDate])).toEqual([
      ["Readiness release", "2026-11-02"], ["Reddit wave 1", "2026-11-09"], ["Reddit wave 2", "2026-11-23"],
    ]);
  });
  it("无文字 PDF、损坏文件和不支持的文件会明确报错", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(organizeTimelineDocument(await file("empty.pdf"), context)).rejects.toThrow("未能读到");
    await expect(organizeTimelineDocument(new File(["broken"], "bad.docx"), context)).rejects.toThrow("无法读取");
    await expect(readTimelineDocument(new File(["old"], "old.doc"))).rejects.toThrow(".docx");
  });
  it("CSV 引号、逗号和换行不会打乱列", () => {
    expect(csvTimelineText('事项,日期\n"Readiness, first\nwave",2026-11-02')).toBe("事项\t日期\nReadiness, first wave\t2026-11-02");
    expect(() => csvTimelineText('"broken')).toThrow("引号");
  });
});

describe("客户与 PM 的横轴排序", () => {
  it("把确认的节点插入固定阶段内部，保持真正的日期顺序", () => {
    const groups = mergeTimelineGroups([{ label: "启动", steps: ["2026-11-01", "2026-11-10"] }, { label: "月报", steps: ["2026-11-30"] }], ["2026-11-05", "2026-11-23"], (s) => s);
    expect(groups.flatMap((g) => g.steps)).toEqual(["2026-11-01", "2026-11-05", "2026-11-10", "2026-11-23", "2026-11-30"]);
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
  });
});
