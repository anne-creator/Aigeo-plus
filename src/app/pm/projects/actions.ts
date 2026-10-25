"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessProject, requireSession } from "@/lib/auth";
import { syncProjectDeliverables } from "@/lib/deliverables";
import { CLIENT_SOURCE_VALUES } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { KPI_METRIC_TYPES, PLAN_TIERS } from "@/lib/rules";
import { addDays, isYmd } from "@/lib/time";
import { websiteSchema } from "@/lib/web";
import { KPI_ROWS } from "../_lib";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** 表单出错时回传给页面：错误 + 用户已经填的内容（页面原样回填，不清空） */
export type ProjectFormState = { error: string | null; values: Record<string, string>; seq: number };

/** 把表单里的文字字段原样收集起来（文件等非文字字段忽略） */
function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

const kpiSchema = z.object({
  metricType: z.enum(
    KPI_METRIC_TYPES.map((k) => k.value),
    { error: "指标类型无效" },
  ),
  name: z.string().min(1, "指标名不能为空").max(60, "指标名过长"),
  targetValue: z.number({ error: "目标值必须是数字" }).finite(),
  unit: z.string().max(20, "单位过长"),
});

const projectSchema = z.object({
  clientName: z.string().min(1, "客户名称不能为空").max(100, "客户名称过长"),
  websiteUrl: websiteSchema,
  startDate: z
    .string()
    .refine(isYmd, "项目开始日期格式必须是 YYYY-MM-DD")
    // isYmd 只校验格式；2026-13-40 这类会被 Date.UTC 进位的值用往返比较拦住
    .refine((s) => addDays(s, 0) === s, "项目开始日期不是有效日期"),
  planTier: z.enum(
    PLAN_TIERS.map((t) => t.value),
    { error: "请选择方案档位" },
  ),
  monthlyFeeUsd: z.number({ error: "月服务费必须是数字" }).positive("月服务费必须大于 0"),
  contractMonths: z.number({ error: "合同月数必须是整数" }).int("合同月数必须是整数").min(1, "合同月数至少 1").max(24, "合同月数最多 24"),
  source: z.enum(CLIENT_SOURCE_VALUES, { error: "请选择客户来源" }),
  notes: z.string().max(2000, "备注过长"),
  kpis: z
    .array(kpiSchema)
    .min(1, "至少需要一条承诺交付 KPI")
    .refine((rows) => rows.filter((k) => k.metricType === "SHOWUP_RATE").length === 1, "必须且只能有一条「提示词池 ShowUp 率」KPI")
    .refine(
      (rows) => rows.every((k) => k.metricType !== "SHOWUP_RATE" || (k.targetValue > 0 && k.targetValue <= 100)),
      "ShowUp 率目标必须在 0–100 之间",
    ),
});

function numberOrNaN(s: string): number {
  if (s === "") return Number.NaN;
  return Number(s);
}

/** 从表单读 KPI 行：第 1 行固定 SHOWUP_RATE；其余行只要填了任一项就算一条 */
function readKpis(formData: FormData): { rows: Array<z.input<typeof kpiSchema>>; error?: string } {
  const rows: Array<z.input<typeof kpiSchema>> = [];
  for (let i = 0; i < KPI_ROWS; i++) {
    const metricType = i === 0 ? "SHOWUP_RATE" : str(formData.get(`kpi_${i}_metricType`));
    const name = i === 0 ? "提示词池 ShowUp 率" : str(formData.get(`kpi_${i}_name`));
    const targetRaw = str(formData.get(`kpi_${i}_target`));
    const unit = i === 0 ? "%" : str(formData.get(`kpi_${i}_unit`));
    if (i > 0 && !metricType && !name && !targetRaw && !unit) continue;
    if (i === 0 && !targetRaw) return { rows, error: "请填写提示词池 ShowUp 率目标（%）" };
    if (!metricType) return { rows, error: `第 ${i + 1} 条 KPI 请选择指标类型` };
    rows.push({ metricType: metricType as z.input<typeof kpiSchema>["metricType"], name, targetValue: numberOrNaN(targetRaw), unit });
  }
  return { rows };
}

function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue ? issue.message : "表单校验失败";
}

export async function createProjectAction(prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const session = await requireSession(["PM"]);
  // 项目必须归属于项目经理：ADMIN 请用管理端的代建表单（带 PM 选择），否则会建出 pmId 指向管理员的项目
  if (session.role !== "PM") redirect("/admin/projects/new");

  const kpis = readKpis(formData);
  let error: string | null = kpis.error ?? null;
  let projectId: string | null = null;
  let syncError: string | null = null;

  if (!error) {
    const parsed = projectSchema.safeParse({
      clientName: str(formData.get("clientName")),
      websiteUrl: str(formData.get("websiteUrl")),
      startDate: str(formData.get("startDate")),
      planTier: str(formData.get("planTier")),
      monthlyFeeUsd: numberOrNaN(str(formData.get("monthlyFeeUsd"))),
      contractMonths: numberOrNaN(str(formData.get("contractMonths")) || "3"),
      source: str(formData.get("source")) || "DIRECT",
      notes: str(formData.get("notes")),
      kpis: kpis.rows,
    });
    if (!parsed.success) {
      error = firstIssue(parsed.error);
    } else {
      const d = parsed.data;
      try {
        const project = await prisma.project.create({
          data: {
            clientName: d.clientName,
            websiteUrl: d.websiteUrl,
            startDate: d.startDate,
            planTier: d.planTier,
            monthlyFeeUsd: d.monthlyFeeUsd,
            contractMonths: d.contractMonths,
            source: d.source,
            notes: d.notes || null,
            status: "ACTIVE",
            pmId: session.uid,
            kpis: {
              create: d.kpis.map((k) => ({
                metricType: k.metricType,
                name: k.name,
                targetValue: k.targetValue,
                unit: k.unit,
              })),
            },
          },
        });
        projectId = project.id;
      } catch (e) {
        error = e instanceof Error ? `保存失败：${e.message}` : "保存失败";
      }
    }
  }

  if (error || !projectId) {
    return { error: error ?? "保存失败", values: formValues(formData), seq: prev.seq + 1 };
  }

  // 档案已落库；节点同步失败时不能再回到空白建档表单（会导致重复建档），而是带错误进入已建的项目
  try {
    await syncProjectDeliverables(projectId);
  } catch (e) {
    syncError = e instanceof Error ? e.message : String(e);
  }
  revalidatePath("/pm");
  revalidatePath("/pm/projects");
  if (syncError) {
    redirect(`/pm/projects/${projectId}?error=${encodeURIComponent(`客户档案已保存，但交付节点生成失败：${syncError}。请联系管理员重新同步节点`)}`);
  }
  redirect(`/pm/projects/${projectId}?created=1`);
}

const basicsSchema = z.object({
  id: z.string().min(1),
  clientName: z.string().min(1, "客户名称不能为空").max(100, "客户名称过长"),
  websiteUrl: websiteSchema,
  source: z.enum(CLIENT_SOURCE_VALUES, { error: "请选择客户来源" }),
  notes: z.string().max(2000, "备注过长"),
});

/** PM 只能改客户名称 / 官网 / 客户来源 / 备注；其它字段由管理员维护 */
export async function updateProjectBasicsAction(prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const session = await requireSession(["PM"]);
  const id = str(formData.get("id"));
  const fail = (message: string): ProjectFormState => ({ error: message, values: formValues(formData), seq: prev.seq + 1 });

  const parsed = basicsSchema.safeParse({
    id,
    clientName: str(formData.get("clientName")),
    websiteUrl: str(formData.get("websiteUrl")),
    source: str(formData.get("source")) || "DIRECT",
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const project = await prisma.project.findUnique({ where: { id: parsed.data.id }, select: { id: true, pmId: true } });
  if (!project || !canAccessProject(session, project)) redirect(`/pm/projects?error=${encodeURIComponent("项目不存在或无权修改")}`);

  let error: string | null = null;
  try {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        clientName: parsed.data.clientName,
        websiteUrl: parsed.data.websiteUrl,
        source: parsed.data.source,
        notes: parsed.data.notes || null,
      },
    });
  } catch (e) {
    error = e instanceof Error ? `保存失败：${e.message}` : "保存失败";
  }
  if (error) return fail(error);

  revalidatePath("/pm");
  revalidatePath("/pm/projects");
  revalidatePath(`/pm/projects/${project.id}`);
  redirect(`/pm/projects/${project.id}?updated=1`);
}
