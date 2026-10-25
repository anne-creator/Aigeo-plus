import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { requestStructuredAi } from "@/lib/openai";
import { aiCredentialsConfigured, aiModel } from "@/lib/ai-config";
import { organizeTasks } from "@/lib/tasks";

const fetchMock = vi.fn();
const options = { workload: "tasks" as const, schema: z.object({ ok: z.boolean() }), schemaName: "test", instructions: "test", text: "test" };
function response(data: unknown, status = "completed") {
  return new Response(JSON.stringify({ id: "resp_test", object: "response", status, model: "test-model", output: [
    { type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(data), annotations: [] }] },
  ] }), { status: 200, headers: { "Content-Type": "application/json" } });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-never-sent");
  for (const key of ["OPENAI_MODEL", "OPENAI_TIMELINE_MODEL", "OPENAI_REVIEW_MODEL", "OPENAI_TASK_MODEL"]) vi.stubEnv(key, "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("缺少 Key 时不发请求；默认模型与单功能覆盖相互独立", async () => {
  vi.stubEnv("OPENAI_API_KEY", "   ");
  expect(aiCredentialsConfigured()).toBe(false);
  await expect(requestStructuredAi(options)).rejects.toThrow("未配置");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(aiModel("timeline")).toBe("gpt-5.6-sol");
  vi.stubEnv("OPENAI_MODEL", "shared-model");
  vi.stubEnv("OPENAI_REVIEW_MODEL", "review-model");
  expect(aiModel("review")).toBe("review-model");
  expect(aiModel("tasks")).toBe("shared-model");
});

it("通过真实 SDK 发送严格 Responses 请求并解析 JSON，不保存响应", async () => {
  fetchMock.mockResolvedValue(response({ ok: true }));
  const result = await requestStructuredAi({ ...options, workload: "review" });
  expect(result).toEqual({ data: { ok: true }, model: "test-model" });
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe("https://api.openai.com/v1/responses");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ model: "gpt-5.6-sol", store: false, reasoning: { effort: "medium" }, text: { format: { type: "json_schema", strict: true } } });
  expect(body).not.toHaveProperty("temperature");
  expect(body).not.toHaveProperty("tools");
});

it("截断的有效 JSON 也不用于业务结果", async () => {
  fetchMock.mockResolvedValue(response({ ok: true }, "incomplete"));
  await expect(requestStructuredAi(options)).rejects.toThrow("未完整生成");
});

it("拒答和不符合 schema 的结果都不能进入业务流程", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", model: "test-model", output: [
    { type: "message", content: [{ type: "refusal", refusal: "not available" }] },
  ] }), { status: 200, headers: { "Content-Type": "application/json" } }));
  await expect(requestStructuredAi(options)).rejects.toThrow("未能处理");
  fetchMock.mockResolvedValueOnce(response({ ok: "wrong type" }));
  await expect(requestStructuredAi(options)).rejects.toThrow("未返回可用结果");
});

it.each([
  [401, "invalid_api_key", "Key 无效"],
  [403, "permission_denied", "权限不足"],
  [429, "insufficient_quota", "额度不足"],
  [404, "model_not_found", "模型不可用"],
])("API 错误 %s 不泄露响应中的密钥内容或自动重试", async (status, code, expected) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "secret-from-provider", type: "api_error", code } }), {
    status, headers: { "Content-Type": "application/json" },
  }));
  const error = await requestStructuredAi(options).catch((e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain(expected);
  expect((error as Error).message).not.toContain("secret-from-provider");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("任务整理接收 OpenAI 输出并限制日期和工时，失败时恢复基础提取", async () => {
  fetchMock.mockResolvedValueOnce(response({ tasks: [{ title: " 发布第二波 ", dueDate: "2026-11-09", note: null, estimatedMinutes: 90 }] }));
  expect(await organizeTasks("明天发布第二波", { today: "2026-11-08" })).toEqual({
    items: [{ title: "发布第二波", dueDate: "2026-11-09", note: null, estimatedMinutes: 90 }], method: "ai",
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
  const fallback = await organizeTasks("2026-11-09 发布第二波", { today: "2026-11-08" });
  expect(fallback.method).toBe("rules");
  expect(fallback.items[0].dueDate).toBe("2026-11-09");
});
