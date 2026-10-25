"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CLIENT_SOURCE_VALUES } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { getQuarterSummary, syncProjectDeliverables } from "@/lib/deliverables";
import { KPI_METRIC_TYPES, PLAN_TIERS, PROJECT_STATUSES, projectEndDate } from "@/lib/rules";
import { kpiStopped } from "@/lib/compensation";
import { aiCredentialsConfigured, runAiReview } from "@/lib/ai-review";
import { getRulesConfig } from "@/lib/settings";
import { diffDays, isYmd, toBjYmd } from "@/lib/time";
import { RENEWAL_STATUSES, failTo, firstIssue, requireAdmin, safeBack, str, withQuery } from "../_lib";
import { websiteSchema } from "@/lib/web";

const ymd = z.string().trim().refine(isYmd, "日期格式须为 YYYY-MM-DD");
/** 必填数字：空串不能被 coerce 成 0 */
const numField = (msg: string) => z.string().trim().min(1, msg).pipe(z.coerce.number({ error: msg }));
const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s));

const projectBase = {
  clientName: z.string().trim().min(1, "客户名称必填").max(200, "客户名称过长"),
  websiteUrl: websiteSchema,
  startDate: ymd,
  planTier: z.enum(
    PLAN_TIERS.map((t) => t.value),
    { error: "请选择方案档位" },
  ),
  monthlyFeeUsd: numField("月服务费必填且须为数字").pipe(z.number().min(0, "月服务费不能为负")),
  contractMonths: numField("合同月数必填").pipe(z.number().int("合同月数须为整数").min(1, "合同月数至少 1").max(120, "合同月数过大")),
  notes: optionalText,
  pmId: z.string().trim().min(1, "请选择项目经理"),
  source: z.enum(CLIENT_SOURCE_VALUES, { error: "请选择客户来源" }),
};

const kpiSchema = z.object({
  metricType: z.enum(
    KPI_METRIC_TYPES.map((t) => t.value),
    { error: "请选择指标类型" },
  ),
  name: z.string().trim().min(1, "指标名必填").max(100, "指标名过长"),
  targetValue: numField("目标值必填且须为数字"),
  unit: z.string().trim().max(30, "单位过长"),
  note: optionalText,
});

async function assertPm(pmId: string, back: string): Promise<void> {
  const pm = await prisma.user.findUnique({ where: { id: pmId }, select: { role: true } });
  if (!pm || pm.role !== "PM") failTo(back, "所选项目经理不存在或角色不是项目经理");
}

/* ---------------------------------- 建档 ---------------------------------- */

export async function createProject(formData: FormData): Promise<void> {
  await requireAdmin();
  const back = "/admin/projects/new";
  const parsed = z
    .object({
      ...projectBase,
      showupTarget: numField("ShowUp 率目标必填且须为数字").pipe(z.number().gt(0, "ShowUp 率目标须大于 0").max(100, "ShowUp 率目标不能超过 100")),
    })
    .safeParse({
      clientName: str(formData, "clientName"),
      websiteUrl: str(formData, "websiteUrl"),
      startDate: str(formData, "startDate"),
      planTier: str(formData, "planTier"),
      monthlyFeeUsd: str(formData, "monthlyFeeUsd"),
      contractMonths: str(formData, "contractMonths") || "3",
      notes: str(formData, "notes"),
      pmId: str(formData, "pmId"),
      source: str(formData, "source") || "DIRECT",
      showupTarget: str(formData, "showupTarget"),
    });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  await assertPm(v.pmId, back);

  // 额外 KPI（最多 3 行，填了指标名才算）
  const extras: z.infer<typeof kpiSchema>[] = [];
  for (let i = 1; i <= 3; i++) {
    const name = str(formData, `kpiName${i}`);
    if (!name) continue;
    const k = kpiSchema.safeParse({
      metricType: str(formData, `kpiType${i}`),
      name,
      targetValue: str(formData, `kpiTarget${i}`),
      unit: str(formData, `kpiUnit${i}`),
      note: "",
    });
    if (!k.success) failTo(back, `第 ${i} 条额外 KPI：${firstIssue(k.error)}`);
    extras.push(k.data);
  }

  const project = await prisma.project.create({
    data: {
      clientName: v.clientName,
      websiteUrl: v.websiteUrl,
      startDate: v.startDate,
      planTier: v.planTier,
      monthlyFeeUsd: v.monthlyFeeUsd,
      contractMonths: v.contractMonths,
      status: "ACTIVE",
      renewalStatus: "NONE",
      notes: v.notes,
      pmId: v.pmId,
      source: v.source,
      kpis: {
        create: [
          { metricType: "SHOWUP_RATE", name: "提示词池 ShowUp 率", targetValue: v.showupTarget, unit: "%" },
          ...extras.map((k) => ({ metricType: k.metricType, name: k.name, targetValue: k.targetValue, unit: k.unit, note: k.note })),
        ],
      },
    },
  });
  await syncProjectDeliverables(project.id);
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${project.id}`, { saved: 1 }));
}

/* -------------------------------- 档案编辑 -------------------------------- */

export async function updateProject(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const back = `/admin/projects/${id}#profile`;
  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!existing) failTo("/admin/projects", "项目不存在");

  const parsed = z
    .object({
      ...projectBase,
      status: z.enum(
        PROJECT_STATUSES.map((s) => s.value),
        { error: "请选择项目状态" },
      ),
      terminationDate: z
        .string()
        .trim()
        .transform((s) => (s === "" ? null : s))
        .refine((s) => s === null || isYmd(s), "暂停/终止日格式须为 YYYY-MM-DD"),
      renewalStatus: z.enum(
        RENEWAL_STATUSES.map((s) => s.value),
        { error: "请选择续约状态" },
      ),
      renewalNote: optionalText,
      renewalMonths: z
        .string()
        .trim()
        .transform((s) => (s === "" ? null : Number(s)))
        .refine((n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 60), "续约时长须为 1–60 的整数月"),
    })
    .safeParse({
      clientName: str(formData, "clientName"),
      websiteUrl: str(formData, "websiteUrl"),
      startDate: str(formData, "startDate"),
      planTier: str(formData, "planTier"),
      monthlyFeeUsd: str(formData, "monthlyFeeUsd"),
      contractMonths: str(formData, "contractMonths"),
      notes: str(formData, "notes"),
      pmId: str(formData, "pmId"),
      source: str(formData, "source") || "DIRECT",
      status: str(formData, "status"),
      terminationDate: str(formData, "terminationDate"),
      renewalStatus: str(formData, "renewalStatus") || "NONE",
      renewalNote: str(formData, "renewalNote"),
      renewalMonths: str(formData, "renewalMonths"),
    });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;

  let terminationDate = v.terminationDate;
  if (v.status === "PAUSED" || v.status === "TERMINATED") {
    if (!terminationDate) failTo(back, "状态为已暂停/已终止时必须填写暂停/终止日");
    if (diffDays(terminationDate, v.startDate) < 0) failTo(back, "暂停/终止日不能早于项目开始日期");
  } else if (v.status === "ACTIVE") {
    // 恢复进行中：清掉终止日，节点自动补回
    terminationDate = null;
  } else if (terminationDate && diffDays(terminationDate, v.startDate) < 0) {
    failTo(back, "暂停/终止日不能早于项目开始日期");
  }
  await assertPm(v.pmId, back);

  await prisma.project.update({
    where: { id },
    data: {
      clientName: v.clientName,
      websiteUrl: v.websiteUrl,
      startDate: v.startDate,
      planTier: v.planTier,
      monthlyFeeUsd: v.monthlyFeeUsd,
      contractMonths: v.contractMonths,
      status: v.status,
      terminationDate,
      renewalStatus: v.renewalStatus,
      renewalNote: v.renewalNote,
      renewalMonths: v.renewalMonths,
      notes: v.notes,
      pmId: v.pmId,
      source: v.source,
    },
  });
  await syncProjectDeliverables(id);
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${id}#profile`, { saved: 1 }));
}

/* ---------------------------------- KPI ---------------------------------- */

export async function addKpi(projectId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const back = `/admin/projects/${projectId}#kpis`;
  const parsed = kpiSchema.safeParse({
    metricType: str(formData, "metricType"),
    name: str(formData, "name"),
    targetValue: str(formData, "targetValue"),
    unit: str(formData, "unit"),
    note: str(formData, "note"),
  });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) failTo("/admin/projects", "项目不存在");
  const v = parsed.data;
  const data = {
    metricType: v.metricType,
    name: v.name,
    targetValue: v.targetValue,
    unit: v.unit || KPI_METRIC_TYPES.find((t) => t.value === v.metricType)?.defaultUnit || "",
    note: v.note,
  };
  if (v.metricType === "SHOWUP_RATE") {
    if (!(v.targetValue > 0)) failTo(back, "ShowUp 率目标须大于 0");
    // ShowUp 率目标只能有一条（达成率/KPI 奖的计算依据）：已有则覆盖，不再新增一条让 find() 取到哪条都不确定
    const existing = await prisma.projectKpi.findFirst({ where: { projectId, metricType: "SHOWUP_RATE" }, orderBy: { id: "asc" }, select: { id: true } });
    if (existing) {
      await prisma.projectKpi.update({ where: { id: existing.id }, data });
      revalidatePath("/", "layout");
      redirect(withQuery(`/admin/projects/${projectId}#kpis`, { saved: 1 }));
    }
  }
  await prisma.projectKpi.create({ data: { projectId, ...data } });
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${projectId}#kpis`, { saved: 1 }));
}

export async function deleteKpi(projectId: string, kpiId: string): Promise<void> {
  await requireAdmin();
  const back = `/admin/projects/${projectId}#kpis`;
  const kpi = await prisma.projectKpi.findUnique({ where: { id: kpiId } });
  if (!kpi || kpi.projectId !== projectId) failTo(back, "KPI 不存在");
  if (kpi.metricType === "SHOWUP_RATE") {
    const n = await prisma.projectKpi.count({ where: { projectId, metricType: "SHOWUP_RATE" } });
    if (n <= 1) failTo(back, "至少保留一条「提示词池 ShowUp 率」KPI（季度 KPI 奖的计算依据）");
  }
  await prisma.projectKpi.delete({ where: { id: kpiId } });
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${projectId}#kpis`, { saved: 1 }));
}

/* ------------------------------ 季度考核与结算 ------------------------------ */

const assessmentSchema = z.object({
  actualShowupRate: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 100), "实际 ShowUp 率须为 0–100 的数字"),
  fxRate: numField("汇率必填且须为数字").pipe(z.number().gt(0, "汇率须大于 0")),
  note: optionalText,
});

async function saveAssessmentInputs(projectId: string, quarter: number, formData: FormData, back: string) {
  const parsed = assessmentSchema.safeParse({
    actualShowupRate: str(formData, "actualShowupRate"),
    fxRate: str(formData, "fxRate"),
    note: str(formData, "note"),
  });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { kpis: true } });
  if (!project) failTo("/admin/projects", "项目不存在");
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > Math.ceil(project.contractMonths / 3)) failTo(back, "考核季度超出合同期限");
  const current = await prisma.quarterAssessment.findUnique({ where: { projectId_quarter: { projectId, quarter } } });
  if (current?.finalizedAt) failTo(back, `第 ${quarter} 季度已结算固化，请先撤销结算再修改`);
  const target = project.kpis.find((k) => k.metricType === "SHOWUP_RATE")?.targetValue ?? null;
  const v = parsed.data;
  await prisma.quarterAssessment.upsert({
    where: { projectId_quarter: { projectId, quarter } },
    create: { projectId, quarter, actualShowupRate: v.actualShowupRate, targetShowupRate: target, fxRate: v.fxRate, note: v.note },
    update: { actualShowupRate: v.actualShowupRate, targetShowupRate: target, fxRate: v.fxRate, note: v.note },
  });
  return project;
}

function quarterAnchor(projectId: string, quarter: number): string {
  return `/admin/projects/${projectId}#q-${quarter}`;
}

export async function saveAssessment(projectId: string, quarter: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const back = quarterAnchor(projectId, quarter);
  await saveAssessmentInputs(projectId, quarter, formData, back);
  revalidatePath("/", "layout");
  redirect(withQuery(quarterAnchor(projectId, quarter), { saved: 1 }));
}

export async function finalizeAssessment(projectId: string, quarter: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const back = quarterAnchor(projectId, quarter);
  const project = await saveAssessmentInputs(projectId, quarter, formData, back);
  const config = await getRulesConfig();
  const summary = await getQuarterSummary(project, quarter, { config, mode: "final" });
  if (project.monthlyFeeUsd > 5000) failTo(back, "大额项目需按单独约定结算，不能套用标准 KPI 奖");
  if (projectEndDate(project.startDate, Math.min(quarter * 3, project.contractMonths)) >= toBjYmd(new Date())) failTo(back, "本季度服务尚未结束，不能提前结算");
  if (!kpiStopped(project, quarter) && !summary.receiptConfirmed) failTo(back, "请先在薪酬页面确认本季度各服务月的实际人民币回款");
  if (!summary.items.length) failTo(back, "没有本季度的交付记录，不能直接结算满奖");
  if (summary.items.some((i) => i.firstSubmittedAt && !["APPROVED", "REJECTED"].includes(i.reviewStatus))) failTo(back, "仍有材料待审核，请先完成交付审核再结算");
  if (summary.actualShowupRate === null) failTo(back, "结算前请先录入实际 ShowUp 率");
  if (summary.targetShowupRate === null || summary.targetShowupRate <= 0) failTo(back, "缺少有效的「提示词池 ShowUp 率」目标，无法计算达成率");

  // 已终止的项目：终止日所在季度及之后，当季 KPI 奖不发
  const pm = await prisma.user.findUniqueOrThrow({ where: { id: project.pmId }, select: { departedOn: true } });
  const terminatedThisQuarter = kpiStopped(project, quarter) || Boolean(pm.departedOn);
  const kpiBonusCny = terminatedThisQuarter ? 0 : summary.bonus.kpiBonusCny;

  await prisma.quarterAssessment.update({
    where: { projectId_quarter: { projectId, quarter } },
    data: {
      achievementPct: summary.bonus.achievementPct,
      tierPct: summary.bonus.tierPct,
      deliveryScorePct: summary.bonus.deliveryScorePct,
      monthlyCommissionCny: summary.bonus.monthlyCommissionCny,
      kpiBonusCny,
      finalizedAt: new Date(),
    },
  });
  revalidatePath("/", "layout");
  redirect(withQuery(quarterAnchor(projectId, quarter), { saved: 1 }));
}

export async function unfinalizeAssessment(projectId: string, quarter: number): Promise<void> {
  await requireAdmin();
  const back = quarterAnchor(projectId, quarter);
  const current = await prisma.quarterAssessment.findUnique({ where: { projectId_quarter: { projectId, quarter } } });
  if (!current) failTo(back, "该季度尚无结算记录");
  await prisma.quarterAssessment.update({
    where: { id: current.id },
    data: {
      finalizedAt: null,
      achievementPct: null,
      tierPct: null,
      deliveryScorePct: null,
      monthlyCommissionCny: null,
      kpiBonusCny: null,
    },
  });
  revalidatePath("/", "layout");
  redirect(withQuery(quarterAnchor(projectId, quarter), { saved: 1 }));
}

/* -------------------------------- 材料审核 -------------------------------- */

export type ReviewDecision = "APPROVED" | "REJECTED" | "PENDING";

/**
 * 审核某个节点：通过 / 不通过（可指定扣分比例，空=系统默认）/ 重置为待审核。
 * 返回错误文案；成功返回 null。
 */
export async function reviewDeliverable(id: string, decision: ReviewDecision, note: string | null, pct: number | null): Promise<string | null> {
  const session = await requireAdmin();
  const d = await prisma.deliverable.findUnique({ where: { id }, include: { _count: { select: { submissions: true } } } });
  if (!d) return "节点不存在";
  if (d._count.submissions === 0) return "该节点尚未提交材料，无法审核";
  // 已结算季度的数字已固化：再改审核结论只会让实时重算与结算单打架
  const assessment = await prisma.quarterAssessment.findUnique({
    where: { projectId_quarter: { projectId: d.projectId, quarter: d.quarter } },
    select: { finalizedAt: true },
  });
  if (assessment?.finalizedAt) return `第 ${d.quarter} 季度已结算固化，请先撤销结算再审核`;
  if (decision === "REJECTED" && !note) return "审核不通过时必须填写审核意见";
  if (pct !== null && !(Number.isFinite(pct) && pct >= 0 && pct <= 100)) return "审核扣分比例须为 0–100";
  await prisma.deliverable.update({
    where: { id },
    data:
      decision === "PENDING"
        ? { reviewStatus: "PENDING", reviewSource: null, reviewNote: null, reviewDeductionPct: null, reviewedById: null, reviewedAt: null }
        : {
            reviewStatus: decision,
            reviewSource: "ADMIN",
            reviewNote: note,
            reviewDeductionPct: decision === "REJECTED" ? pct : null,
            reviewedById: session.uid,
            reviewedAt: new Date(),
          },
  });
  return null;
}

/** 表单入口：字段 deliverableId / decision / note / pct / redirect */
export async function reviewAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "deliverableId");
  const decision = str(formData, "decision") as ReviewDecision;
  const back = safeBack(formData.get("redirect"), "/admin/reviews");
  if (!["APPROVED", "REJECTED", "PENDING"].includes(decision)) failTo(back, "无效的审核操作");
  const note = str(formData, "note") || null;
  const pctRaw = str(formData, "pct");
  const pct = pctRaw === "" ? null : Number(pctRaw);
  const err = await reviewDeliverable(id, decision, note, pct);
  if (err) failTo(back, err);
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1, error: null }));
}

/** 让 AI 重新审核最新一版提交：先把节点放回待审核，再同步跑一次 AI 审核 */
export async function aiRereviewAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "deliverableId");
  const back = safeBack(formData.get("redirect"), "/admin/reviews");
  if (!aiCredentialsConfigured()) failTo(back, "服务器没有配置 OPENAI_API_KEY，无法运行 AI 审核");
  const latest = await prisma.submission.findFirst({ where: { deliverableId: id }, orderBy: { version: "desc" }, select: { id: true } });
  if (!latest) failTo(back, "该节点尚未提交材料");
  const err = await reviewDeliverable(id, "PENDING", null, null);
  if (err) failTo(back, err);
  const out = await runAiReview(latest.id);
  revalidatePath("/", "layout");
  if (out.status !== "reviewed") failTo(back, `AI 审核未完成：${out.reason}`);
  redirect(withQuery(back, { saved: 1, error: null }));
}
