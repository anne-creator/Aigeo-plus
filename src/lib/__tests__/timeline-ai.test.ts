import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse: mock.parse }; } }));
import { organizeTimelineDocument } from "@/lib/timeline-document";
const context = { startDate: "2026-10-01", endDate: "2026-12-29" };
const source = "2026-11-02 Readiness 发布";
const file = () => new File([source], "timeline.txt");
afterEach(() => { vi.unstubAllEnvs(); mock.parse.mockReset(); });

it("AI 结构化结果保留原文，无法核实的日期清空", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  mock.parse.mockResolvedValue({ status: "completed", output: [], model: "test-model", output_parsed: { items: [
    { title: "Readiness 发布", dueDate: "2026-11-02", source, warning: null },
    { title: "第二波", dueDate: "2026-11-25", source: "原文中不存在的第二波", warning: null },
  ], warnings: [] } });
  const r = await organizeTimelineDocument(file(), context);
  expect(r.method).toBe("ai");
  expect(r.items[0].dueDate).toBe("2026-11-02");
  expect(r.items[1].dueDate).toBeNull();
  expect(r.items[1].warning).toContain("未能在原文核实");
});

it("AI 结果被截断时不接受不完整计划，明确降级提示", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  mock.parse.mockResolvedValue({ status: "incomplete", output: [], model: "test-model", output_parsed: { items: [], warnings: [] } });
  const r = await organizeTimelineDocument(file(), context);
  expect(r.method).toBe("rules");
  expect(r.warnings.join()).toContain("暂不可用");
  expect(r.items).toHaveLength(1);
});

it("AI 服务出错时仍保留可核对的基础提取结果", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  mock.parse.mockRejectedValue(new Error("provider unavailable"));
  const r = await organizeTimelineDocument(file(), context);
  expect(r.items[0].source).toBe(source);
  expect(r.method).toBe("rules");
  expect(r.warnings).not.toEqual([]);
});


it("无文字 PDF 通过 OpenAI 原始文件输入识别，仍要求核对扫描件", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  const { readFile } = await import("node:fs/promises");
  const pdf = await readFile(new URL("./fixtures/empty.pdf", import.meta.url));
  mock.parse.mockResolvedValue({ status: "completed", output: [], model: "test-model", output_parsed: {
    items: [{ title: "Readiness 发布", dueDate: "2026-11-02", source, warning: null }], warnings: [],
  } });
  const r = await organizeTimelineDocument(new File([pdf], "扫描计划.pdf"), context);
  expect(r.method).toBe("ai");
  expect(r.items[0].warning).toContain("扫描件识别");
  expect(mock.parse.mock.calls[0][0].input[0].content[1]).toEqual({
    type: "input_file", filename: "扫描计划.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
  });
});
