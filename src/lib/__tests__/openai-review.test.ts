import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  parse: vi.fn(), submission: vi.fn(), fresh: vi.fn(), assessment: vi.fn(), create: vi.fn(), update: vi.fn(),
}));
vi.mock("openai", () => ({ default: class { responses = { parse: mocks.parse }; } }));
vi.mock("@/lib/settings", async () => ({ getRulesConfig: async () => (await import("@/lib/rules")).DEFAULT_RULES }));
vi.mock("@/lib/db", () => {
  const prisma = {
    submission: { findUnique: mocks.submission, findMany: async () => [] },
    quarterAssessment: { findUnique: mocks.assessment },
    aiReview: { create: mocks.create },
    deliverable: { findUnique: mocks.fresh, update: mocks.update },
  };
  return { prisma: { ...prisma, $transaction: async (fn: (tx: typeof prisma) => unknown) => fn(prisma) } };
});
import { runAiReview } from "@/lib/ai-review";

const deliverable = { id: "d", projectId: "p", quarter: 1, title: "周报", code: "WEEKLY_UPDATE", kind: "TEXT", reviewStatus: "PENDING",
  project: { clientName: "测试", planTier: "GROW", startDate: "2026-10-01", kpis: [] }, submissions: [{ id: "s" }],
};
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.submission.mockResolvedValue({ id: "s", textContent: "上周发布 3 篇文章，本周发布 5 篇。", deliverable });
  mocks.fresh.mockResolvedValue(deliverable);
  mocks.assessment.mockResolvedValue(null);
  mocks.parse.mockResolvedValue({ status: "completed", output: [], model: "openai-tested-model", output_parsed: { score: 65, summary: "缺少发布链接", issues: ["请补充链接"] } });
});
afterEach(() => vi.unstubAllEnvs());

it("OpenAI 结果按既有分数段审核并保存实际模型名", async () => {
  expect(await runAiReview("s")).toEqual({ status: "reviewed", score: 65, verdict: "FAIL", deductionPct: 20 });
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ model: "openai-tested-model", score: 65, deductionPct: 20 }) });
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "d" }, data: expect.objectContaining({ reviewStatus: "REJECTED", reviewSource: "AI", reviewDeductionPct: 20 }) });
  expect(mocks.parse.mock.calls[0][0].reasoning).toEqual({ effort: "medium" });
});

it("鉴权失败只记录脱敏错误，不改变待审核状态", async () => {
  mocks.parse.mockRejectedValue({ status: 401, message: "Incorrect API key: private-secret" });
  const result = await runAiReview("s");
  expect(result.status).toBe("error");
  expect(JSON.stringify(result)).toContain("Key 无效");
  expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("private-secret");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("生成期间人工审核通过或出现新版本时，不覆盖管理员和新提交", async () => {
  mocks.fresh.mockResolvedValueOnce({ ...deliverable, reviewStatus: "APPROVED", reviewSource: "ADMIN" });
  await runAiReview("s");
  expect(mocks.update).not.toHaveBeenCalled();
  mocks.fresh.mockResolvedValueOnce({ ...deliverable, submissions: [{ id: "new-version" }] });
  await runAiReview("s");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("缺少 Key 或季度已经结算时不调用模型", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await runAiReview("s")).status).toBe("skipped");
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  mocks.assessment.mockResolvedValue({ finalizedAt: new Date() });
  expect((await runAiReview("s")).status).toBe("skipped");
  expect(mocks.parse).not.toHaveBeenCalled();
});
