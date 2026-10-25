import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { z } from "zod/v4";
import { aiCredentialsConfigured, aiModel, type AiWorkload } from "./ai-config";

class AiRequestError extends Error {}

/** 不转发服务商的原始错误：鉴权错误可能包含密钥片段或请求内容。 */
export function safeAiError(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  const e = error as { status?: number; code?: string; name?: string } | null;
  if (e?.status === 401) return "OpenAI API Key 无效，请管理员检查服务器配置";
  if (e?.status === 403) return "OpenAI 项目或模型访问权限不足，请管理员检查 API 权限";
  if (e?.code === "insufficient_quota") return "OpenAI API 额度不足，请管理员检查 API 账户余额和用量上限";
  if (e?.status === 429) return "OpenAI 请求限流或额度不足，请稍后重试或检查 API 用量";
  if (e?.status === 404) return "OpenAI 模型不可用，请管理员检查模型名称和访问权限";
  if (e?.name === "APIConnectionTimeoutError" || e?.name === "AbortError") return "OpenAI 请求超时，请稍后重试";
  return "OpenAI 暂时未返回可用结果，请稍后重试或由管理员人工处理";
}

/** 仅供服务器调用。三个功能共用凭证和严格结构化输出，拒绝使用截断或不合规的结果。 */
export async function requestStructuredAi<T>(options: {
  workload: AiWorkload;
  schema: z.ZodType<T>;
  schemaName: string;
  instructions: string;
  text: string;
  pdf?: { filename: string; buffer: Buffer };
  maxOutputTokens?: number;
}): Promise<{ data: T; model: string }> {
  if (!aiCredentialsConfigured()) throw new AiRequestError("未配置 OpenAI API Key");
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!.trim(),
      baseURL: "https://api.openai.com/v1",
      timeout: 90_000,
      maxRetries: 0,
    });
    const content: ResponseInputContent[] = [{ type: "input_text", text: options.text }];
    if (options.pdf) content.push({
      type: "input_file",
      filename: options.pdf.filename,
      file_data: `data:application/pdf;base64,${options.pdf.buffer.toString("base64")}`,
    });
    const response = await client.responses.parse({
      model: aiModel(options.workload),
      instructions: options.instructions,
      input: [{ role: "user", content }],
      text: { format: zodTextFormat(options.schema, options.schemaName) },
      reasoning: { effort: options.workload === "review" ? "medium" : "low" },
      max_output_tokens: options.maxOutputTokens ?? 16_000,
      store: false,
    });
    if (response.status !== "completed") throw new AiRequestError("OpenAI 结果未完整生成，请缩短材料后重试");
    if (response.output.some((item) => item.type === "message" && item.content.some((c) => c.type === "refusal"))) {
      throw new AiRequestError("OpenAI 未能处理该材料，请检查内容或交由管理员人工处理");
    }
    if (response.output_parsed == null) throw new AiRequestError("OpenAI 未返回可用的结构化结果");
    return { data: options.schema.parse(response.output_parsed), model: response.model };
  } catch (error) {
    throw new AiRequestError(safeAiError(error));
  }
}
