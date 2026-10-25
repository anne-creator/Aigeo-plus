"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { syncProjectDeliverables } from "@/lib/deliverables";
import { DEFAULT_RULES, DELIVERABLE_CODES, type RulesConfig } from "@/lib/rules";
import { getRulesConfig, saveRulesConfig } from "@/lib/settings";
import { RUNNING_STATUSES, failTo, firstIssue, requireAdmin, str, withQuery } from "../_lib";
import { aiModel, type AiWorkload } from "@/lib/ai-config";
import { requestStructuredAi, safeAiError } from "@/lib/openai";

const BACK = "/admin/settings";

export type AiConnectionResult = { ok: boolean; message: string } | null;

export async function testOpenAiConnection(): Promise<AiConnectionResult> {
  await requireAdmin();
  const checked = new Set<string>();
  try {
    for (const workload of ["timeline", "review", "tasks"] satisfies AiWorkload[]) {
      const model = aiModel(workload);
      if (checked.has(model)) continue;
      const response = await requestStructuredAi({
        workload, schema: z.object({ ok: z.boolean() }), schemaName: "connection_check",
        instructions: "这是 API 连接测试。请返回 ok 为 true 的结构化结果。",
        text: "检查连接", maxOutputTokens: 2048,
      });
      if (!response.data.ok) return { ok: false, message: "OpenAI 返回的测试结果不符合预期，请重试。" };
      checked.add(model);
    }
    return { ok: true, message: `连接成功，已验证模型：${[...checked].join("、")}。` };
  } catch (error) {
    return { ok: false, message: safeAiError(error) };
  }
}

/** 必填数字：空串不能被 coerce 成 0 */
const num = (msg: string) => z.string().trim().min(1, msg).pipe(z.coerce.number({ error: msg }));

const schema = z.object({
  fxRate: num("汇率必填且须为数字").pipe(z.number().gt(0, "汇率须大于 0")),
  commissionPct: num("月提成比例必填且须为数字").pipe(z.number().min(0, "月提成比例不能为负").max(100, "月提成比例不能超过 100%")),
  reviewRejectDeductionPct: num("审核不通过扣分比例必填且须为数字").pipe(z.number().min(0, "扣分比例不能为负").max(100, "扣分比例不能超过 100")),
  monthlyReportWindowDays: num("月报提交窗口必填").pipe(z.number().int("月报提交窗口须为整数").min(1, "至少 1 天").max(60, "不超过 60 天")),
  quarterReportWindowDays: num("季报提交窗口必填").pipe(z.number().int("季报提交窗口须为整数").min(1, "至少 1 天").max(60, "不超过 60 天")),
  timelineWeight: num("timeline 条目权重必填").pipe(z.number().min(0, "权重不能为负").max(100, "权重过大")),
  timelineGraceDays: num("timeline 宽限天数必填").pipe(z.number().int("宽限天数须为整数").min(0, "不能为负").max(60, "不超过 60 天")),
  timelinePenaltyPerDayPct: num("timeline 日扣比例必填").pipe(z.number().gt(0, "须大于 0").max(100, "不能超过 100")),
  deliverables: z.record(
    z.enum(DELIVERABLE_CODES),
    z.object({
      weight: num("权重必填且须为数字").pipe(z.number().min(0, "权重不能为负").max(1000, "权重过大")),
      penaltyPerDayPct: num("日扣比例必填且须为数字").pipe(z.number().gt(0, "每延期 1 天扣分比例须大于 0").max(100, "日扣比例不能超过 100")),
      enabled: z.boolean(),
    }),
  ),
});

/** 窗口天数影响月报/季报截止日：重算所有进行中/已暂停项目的节点 */
async function resyncRunningProjects(): Promise<void> {
  const projects = await prisma.project.findMany({ where: { status: { in: [...RUNNING_STATUSES] } }, select: { id: true } });
  for (const p of projects) await syncProjectDeliverables(p.id);
}

function done(): never {
  revalidatePath("/", "layout");
  redirect(withQuery(BACK, { saved: 1 }));
}

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const deliverables: Record<string, { weight: string; penaltyPerDayPct: string; enabled: boolean }> = {};
  for (const code of DELIVERABLE_CODES) {
    deliverables[code] = {
      weight: str(formData, `weight_${code}`),
      penaltyPerDayPct: str(formData, `penalty_${code}`),
      // 复选框：勾选时提交 "1"，未勾选不提交
      enabled: str(formData, `enabled_${code}`) === "1",
    };
  }
  const parsed = schema.safeParse({
    fxRate: str(formData, "fxRate"),
    timelineWeight: str(formData, "timelineWeight"),
    timelineGraceDays: str(formData, "timelineGraceDays"),
    timelinePenaltyPerDayPct: str(formData, "timelinePenaltyPerDayPct"),
    commissionPct: str(formData, "commissionPct"),
    reviewRejectDeductionPct: str(formData, "reviewRejectDeductionPct"),
    monthlyReportWindowDays: str(formData, "monthlyReportWindowDays"),
    quarterReportWindowDays: str(formData, "quarterReportWindowDays"),
    deliverables,
  });
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const v = parsed.data;
  // 本页没有编辑入口的字段（如 timeline 扣分规则）原样保留，不要被默认值覆盖
  // AI 审核参数在本页另一块表单维护，这里原样保留
  const current = await getRulesConfig();
  const next: RulesConfig = {
    aiReview: current.aiReview,
    fxRate: v.fxRate,
    timeline: { weight: v.timelineWeight, graceDays: v.timelineGraceDays, penaltyPerDayPct: v.timelinePenaltyPerDayPct },
    commissionRate: DEFAULT_RULES.commissionRate,
    reviewRejectDeductionPct: v.reviewRejectDeductionPct,
    monthlyReportWindowDays: v.monthlyReportWindowDays,
    quarterReportWindowDays: v.quarterReportWindowDays,
    deliverables: { ...DEFAULT_RULES.deliverables },
  };
  for (const code of DELIVERABLE_CODES) {
    const d = v.deliverables[code];
    if (!d) failTo(BACK, `缺少 ${code} 的权重/扣分设置`);
    // 完整写回 DeliverableTypeConfig：漏掉 enabled 会被 mergeRules 重置为默认值（建议项又变回关闭）
    next.deliverables[code] = { weight: d.weight, penaltyPerDayPct: d.penaltyPerDayPct, enabled: d.enabled };
  }
  await saveRulesConfig(next);
  await resyncRunningProjects();
  done();
}

const aiSchema = z.object({
  passScore: num("通过线必填").pipe(z.number().int("通过线须为整数").min(0, "通过线 0–100").max(100, "通过线 0–100")),
  bands: z
    .array(
      z.object({
        minScore: num("分数段下限必填").pipe(z.number().int("分数须为整数").min(0, "分数 0–100").max(100, "分数 0–100")),
        deductionPct: num("扣除比例必填").pipe(z.number().min(0, "扣除比例 0–100").max(100, "扣除比例 0–100")),
      }),
    )
    .min(1),
});

/** AI 审核参数：开关、通过线、低于通过线时按分数段扣该项的比例 */
export async function saveAiReviewSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const bands = [0, 1, 2].map((i) => ({ minScore: str(formData, `band_min_${i}`), deductionPct: str(formData, `band_pct_${i}`) }));
  const parsed = aiSchema.safeParse({ passScore: str(formData, "passScore"), bands });
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const v = parsed.data;
  const sorted = [...v.bands].sort((a, b) => b.minScore - a.minScore);
  if (sorted[0].minScore >= v.passScore) failTo(BACK, "扣分段的分数下限要低于通过线");
  if (sorted.at(-1)!.minScore !== 0) failTo(BACK, "最后一个扣分段的下限须为 0，保证所有分数都有对应扣除");
  const current = await getRulesConfig();
  await saveRulesConfig({ ...current, aiReview: { enabled: str(formData, "enabled") === "1", passScore: v.passScore, bands: sorted } });
  done();
}

export async function resetSettings(): Promise<void> {
  await requireAdmin();
  await saveRulesConfig(DEFAULT_RULES);
  await resyncRunningProjects();
  done();
}
