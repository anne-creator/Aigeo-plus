"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPmPay } from "@/lib/pay";
import { isYmd, toBjYmd } from "@/lib/time";
import { projectEndDate } from "@/lib/rules";
import { failTo, firstIssue, requireAdmin, str, withQuery } from "../_lib";

const hoursSchema = z.object({
  userId: z.string().min(1),
  month: z.string().refine((s) => isYmd(`${s}-01`), "月份格式须为 YYYY-MM"),
  avgDailyHours: z.string().min(1, "请填写日均小时数").transform(Number).pipe(z.number().min(0, "不能小于 0").max(24, "不能超过 24")),
});

/** 录入某月日均有效工作时间（底薪按此分档） */
export async function saveMonthlyHours(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = str(formData, "userId");
  const back = `/admin/pay/${userId}`;
  const parsed = hoursSchema.safeParse({ userId, month: str(formData, "month"), avgDailyHours: str(formData, "avgDailyHours") });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: v.userId }, select: { role: true } });
  if (!user || user.role !== "PM") failTo("/admin/pay", "账号不存在或不是项目经理");
  await prisma.monthlyHours.upsert({
    where: { userId_month: { userId: v.userId, month: v.month } },
    create: v,
    update: { avgDailyHours: v.avgDailyHours },
  });
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1 }));
}

/** 续约奖标记已发放 / 撤销 */
export async function setRenewalPaid(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = str(formData, "projectId");
  const pmId = str(formData, "pmId");
  const paid = str(formData, "paid") === "1";
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, pmId: true } });
  if (!project || project.pmId !== pmId) failTo("/admin/pay", "项目不存在");
  const pay = await getPmPay(pmId);
  const renewal = pay.renewals.find((r) => r.projectId === projectId);
  if (paid && (!renewal || !renewal.payable)) failTo(`/admin/pay/${pmId}`, renewal?.status ?? "该项目没有符合条件的续约奖");
  await prisma.project.update({ where: { id: projectId }, data: { renewalPaidAt: paid ? new Date() : null, renewalPaidCny: paid ? renewal!.bonusCny : null } });
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/pay/${pmId}`, { saved: 1 }));
}

const requiredNumber = (label: string) => z.string().trim().min(1, `请填写${label}`).transform(Number).pipe(z.number().finite().min(0, `${label}不能小于 0`));

/** 按服务月分摊实际回款；按分拆分尾差，合计始终等于到账金额。 */
export async function saveServiceReceipt(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = str(formData, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) failTo("/admin/pay", "项目不存在");
  const back = `/admin/pay/${project.pmId}`;
  const parsed = z.object({
    firstMonth: requiredNumber("起始服务月").pipe(z.number().int().min(1)),
    months: requiredNumber("覆盖月数").pipe(z.number().int().min(1).max(60)),
    receivedCny: requiredNumber("实际到账人民币").pipe(z.number().max(1_000_000_000)).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "金额最多两位小数"),
    note: z.string().max(1000, "备注最多 1000 字"),
  }).safeParse({ firstMonth: str(formData, "firstMonth"), months: str(formData, "months"), receivedCny: str(formData, "receivedCny"), note: str(formData, "note") });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  if (v.firstMonth + v.months - 1 > project.contractMonths) failTo(back, "回款覆盖的服务月超出了合同期限");
  const totalCents = Math.round(v.receivedCny * 100);
  const each = Math.floor(totalCents / v.months);
  const blocked = await prisma.$transaction(async (tx) => {
    const finalized = await tx.quarterAssessment.findFirst({ where: { projectId, finalizedAt: { not: null }, quarter: { gte: Math.ceil(v.firstMonth / 3), lte: Math.ceil((v.firstMonth + v.months - 1) / 3) } } });
    if (finalized) return true;
    for (let i = 0; i < v.months; i++) {
      const data = { receivedCny: (each + (i === v.months - 1 ? totalCents - each * v.months : 0)) / 100, note: v.note || null, confirmedById: admin.uid };
      await tx.serviceReceipt.upsert({ where: { projectId_serviceMonth: { projectId, serviceMonth: v.firstMonth + i } }, create: { projectId, serviceMonth: v.firstMonth + i, ...data }, update: data });
    }
    return false;
  });
  if (blocked) failTo(back, "对应季度已结算；请先撤销季度结算再调整回款");
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1 }));
}

export async function saveRenewalTerms(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = str(formData, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) failTo("/admin/pay", "项目不存在");
  const back = `/admin/pay/${project.pmId}`;
  if (project.renewalPaidAt) failTo(back, "续约奖已发放，请先撤销发放再修改依据");
  if (project.renewalStatus !== "RENEWED" || !project.renewalMonths) failTo(back, "请先在项目档案确认续约成功及续约月数");
  const date = z.string().refine(isYmd, "请填写有效日期");
  const optionalAmount = (label: string) => z.union([z.literal("").transform(() => null), requiredNumber(label)]);
  const parsed = z.object({
    renewalSignedDate: date,
    renewalStartDate: date,
    renewalServedPaidMonths: optionalAmount("实际服务并回款月数"),
    renewalReceivedCny: optionalAmount("续约期实际回款"),
  }).safeParse(Object.fromEntries(["renewalSignedDate", "renewalStartDate", "renewalServedPaidMonths", "renewalReceivedCny"].map((k) => [k, str(formData, k)])));
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  if (v.renewalSignedDate > toBjYmd(new Date())) failTo(back, "签约日不能是未来日期");
  if (v.renewalStartDate <= projectEndDate(project.startDate, project.contractMonths)) failTo(back, "新一期续约服务应在原合同服务期结束后开始");
  if (v.renewalSignedDate > v.renewalStartDate) failTo(back, "签约日不能晚于续约服务开始日");
  if ((v.renewalServedPaidMonths === null) !== (v.renewalReceivedCny === null)) failTo(back, "实际服务并回款月数与回款金额需一起填写，或都留空");
  if (v.renewalServedPaidMonths !== null && (v.renewalServedPaidMonths > project.renewalMonths || !Number.isInteger(v.renewalServedPaidMonths))) failTo(back, "实际月数应为不超过续约时长的整数");
  if ((v.renewalServedPaidMonths === 0) !== (v.renewalReceivedCny === 0)) failTo(back, "服务月数为 0 时，回款金额也应为 0");
  await prisma.project.update({ where: { id: projectId }, data: v });
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1 }));
}

export async function saveDepartureDate(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = str(formData, "userId");
  const departedOn = str(formData, "departedOn");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "PM") failTo("/admin/pay", "项目经理不存在");
  const back = `/admin/pay/${userId}`;
  if (departedOn && (!isYmd(departedOn) || departedOn > toBjYmd(new Date()))) failTo(back, "请填写有效的已发生离职日期");
  await prisma.user.update({ where: { id: userId }, data: { departedOn: departedOn || null } });
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1 }));
}
