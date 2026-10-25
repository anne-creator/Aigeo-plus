import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth";

const state = vi.hoisted(() => ({ directory: "", session: { uid: "admin", role: "ADMIN", name: "Admin", username: "admin" } as Session }));
vi.mock("@/lib/auth", () => ({ getSession: async () => state.session, clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + decodeURIComponent(url)); } }));
vi.mock("@/lib/db", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { PrismaClient } = await import("@prisma/client");
  state.directory = mkdtempSync(join(tmpdir(), "aigeo-pay-test-"));
  const url = "file:" + join(state.directory, "test.db");
  writeFileSync(join(state.directory, "test.db"), "");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

import { prisma } from "@/lib/db";
import { getPmPay } from "@/lib/pay";
import { getQuarterSummary, syncProjectDeliverables } from "@/lib/deliverables";
import { getRulesConfig } from "@/lib/settings";
import { saveServiceReceipt, saveMonthlyHours, saveRenewalTerms, setRenewalPaid, saveDepartureDate } from "@/app/admin/pay/actions";
import { finalizeAssessment } from "@/app/admin/projects/actions";
import { endOfDayBj } from "@/lib/time";

const now = endOfDayBj("2026-10-24");
function form(v: Record<string, string | number>) { const f = new FormData(); for (const [k, value] of Object.entries(v)) f.set(k, String(value)); return f; }
const receipt = (amount: number, firstMonth = 1, months = 1) => saveServiceReceipt(form({ projectId: "project", firstMonth, months, receivedCny: amount, note: "测试回款" }));
beforeAll(async () => {
  await prisma.user.createMany({ data: [
    { id: "admin", username: "admin", name: "Admin", role: "ADMIN", passwordHash: "unused" },
    { id: "pm", username: "pm", name: "PM", role: "PM", passwordHash: "unused" },
  ] });
});
beforeEach(async () => {
  state.session = { uid: "admin", role: "ADMIN", name: "Admin", username: "admin" };
  await prisma.project.deleteMany();
  await prisma.monthlyHours.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.update({ where: { id: "pm" }, data: { departedOn: null, active: true } });
  await prisma.project.create({ data: { id: "project", clientName: "收入测试", websiteUrl: "", startDate: "2026-10-01", planTier: "GROW", monthlyFeeUsd: 3300, contractMonths: 3, pmId: "pm", kpis: { create: { metricType: "SHOWUP_RATE", name: "ShowUp", targetValue: 50, unit: "%" } } } });
});
afterAll(async () => { await prisma.$disconnect(); const { rm } = await import("node:fs/promises"); await rm(state.directory, { recursive: true, force: true }); });

describe.sequential("PDF 薪酬规则与月度回款流程", () => {
  it("未知工时与效果都显示待确认，不默认给底薪或满奖", async () => {
    const pay = await getPmPay("pm", now);
    expect(pay.base).toMatchObject({ source: "PENDING", salary: 0 });
    expect(pay.projects[0]).toMatchObject({ commissionCny: 2244, confirmedCommissionCny: null, bonusPending: true, projectedBonusCny: 0, monthlyFullScenarioCny: 3740 });
    expect(pay.confirmedCommissionTotal).toBe(0);
  });
  it("固定 10% 不受旧配置影响；季度预付款分月，不在首月全部计提", async () => {
    await prisma.setting.create({ data: { key: "rules", value: JSON.stringify({ commissionRate: 0.5 }) } });
    expect((await getRulesConfig()).commissionRate).toBe(0.1);
    await expect(receipt(67320, 1, 3)).rejects.toThrow("saved=1");
    const pay = await getPmPay("pm", now);
    expect(pay.commissionTotal).toBe(2244);
    expect(pay.confirmedCommissionTotal).toBe(2244);
    expect(pay.projects[0].ledger.map((m) => m.commissionCny)).toEqual([2244, 2244, 2244]);
  });
  it("预付款分摊尾差不丢失，重复录入更新而非重复累加", async () => {
    await expect(receipt(100, 1, 3)).rejects.toThrow("saved=1");
    let rows = await prisma.serviceReceipt.findMany({ orderBy: { serviceMonth: "asc" } });
    expect(rows.map((r) => r.receivedCny)).toEqual([33.33, 33.33, 33.34]);
    await expect(receipt(99, 1, 3)).rejects.toThrow("saved=1");
    rows = await prisma.serviceReceipt.findMany();
    expect(rows).toHaveLength(3);
    expect(rows.reduce((s, r) => s + r.receivedCny, 0)).toBe(99);
  });
  it("实际回款优先于汇率估算，明确录入 0 也不能当作未知", async () => {
    await expect(receipt(23000)).rejects.toThrow("saved=1");
    expect((await getPmPay("pm", now)).commissionTotal).toBe(2300);
    await expect(receipt(0)).rejects.toThrow("saved=1");
    expect((await getPmPay("pm", now)).projects[0]).toMatchObject({ commissionCny: 0, confirmedCommissionCny: 0, incomeStatus: "本服务月未回款" });
  });
  it("暂停当服务月保留提成，下月停止，不再发当季 KPI", async () => {
    await prisma.project.update({ where: { id: "project" }, data: { status: "PAUSED", terminationDate: "2026-10-15" } });
    const pay = await getPmPay("pm", now);
    expect(pay.commissionTotal).toBe(2244);
    expect(pay.projects[0]).toMatchObject({ projectedBonusCny: 0, bonusPending: false });
    expect((await getPmPay("pm", endOfDayBj("2026-10-31")))).toMatchObject({ commissionTotal: 0 });
  });
  it("未来/已过期项目不继续计提，大额项目不自动套用 10%", async () => {
    expect((await getPmPay("pm", endOfDayBj("2026-09-30")))).toMatchObject({ commissionTotal: 0 });
    expect((await getPmPay("pm", endOfDayBj("2027-01-01")))).toMatchObject({ commissionTotal: 0 });
    await prisma.project.update({ where: { id: "project" }, data: { monthlyFeeUsd: 5001 } });
    const pay = await getPmPay("pm", now);
    expect(pay.projects[0]).toMatchObject({ custom: true, commissionCny: 0, monthlyFullScenarioCny: null });
    expect(pay.customProjectCount).toBe(1);
  });
  it("底薪按工时边界核算，空值不能被当成零工时", async () => {
    await expect(saveMonthlyHours(form({ userId: "pm", month: "2026-10", avgDailyHours: "" }))).rejects.toThrow("error=");
    await expect(saveMonthlyHours(form({ userId: "pm", month: "2026-13", avgDailyHours: 6 }))).rejects.toThrow("error=");
    await expect(saveMonthlyHours(form({ userId: "pm", month: "2026-10", avgDailyHours: 6 }))).rejects.toThrow("saved=1");
    expect((await getPmPay("pm", now)).monthlyFixed).toBe(10244);
  });
  it("非管理员不能修改回款、工时、续约依据或离职日期", async () => {
    state.session = { uid: "pm", role: "PM", name: "PM", username: "pm" };
    for (const operation of [() => receipt(100), () => saveMonthlyHours(form({})), () => saveRenewalTerms(form({})), () => saveDepartureDate(form({})), () => setRenewalPaid(form({}))]) {
      await expect(operation()).rejects.toThrow("仅管理员");
    }
    expect(await prisma.serviceReceipt.count()).toBe(0);
  });
  it("越界、负数及空白回款不会写入", async () => {
    await expect(receipt(100, 3, 2)).rejects.toThrow("超出了合同期限");
    await expect(receipt(-1)).rejects.toThrow("error=");
    await expect(saveServiceReceipt(form({ projectId: "project", firstMonth: 1, months: 1, receivedCny: "" }))).rejects.toThrow("error=");
    expect(await prisma.serviceReceipt.count()).toBe(0);
  });
  it("季度奖金使用完整实际回款的平均月提成，60% 档正确；已结算金额不随汇率重算", async () => {
    await receipt(63000, 1, 3).catch(() => {});
    await prisma.quarterAssessment.create({ data: { projectId: "project", quarter: 1, actualShowupRate: 50, targetShowupRate: 50 } });
    const p = await prisma.project.findUniqueOrThrow({ where: { id: "project" }, include: { kpis: true } });
    const s = await getQuarterSummary(p, 1, { asOf: now });
    expect(s.receiptConfirmed).toBe(true);
    expect(s.bonus.monthlyCommissionCny).toBe(2100);
    expect(s.bonus.kpiBonusCny).toBe(1260);
    await prisma.quarterAssessment.update({ where: { projectId_quarter: { projectId: "project", quarter: 1 } }, data: { finalizedAt: now, monthlyCommissionCny: 2100, kpiBonusCny: 1000, tierPct: 60, deliveryScorePct: 79.37 } });
    await prisma.setting.create({ data: { key: "rules", value: JSON.stringify({ fxRate: 9 }) } });
    expect((await getPmPay("pm", now)).projects[0].projectedBonusCny).toBe(1000);
    await expect(receipt(100)).rejects.toThrow("请先撤销季度结算");
  });
  it("季度结算前核验结束日、回款和审核", async () => {
    const f = form({ actualShowupRate: 65, fxRate: 6.8, note: "测试" });
    await expect(finalizeAssessment("project", 1, f)).rejects.toThrow("尚未结束");
    await prisma.project.update({ where: { id: "project" }, data: { startDate: "2026-01-01" } });
    await expect(finalizeAssessment("project", 1, f)).rejects.toThrow("实际人民币回款");
    await receipt(67320, 1, 3).catch(() => {});
    await syncProjectDeliverables("project");
    await prisma.deliverable.updateMany({ data: { firstSubmittedAt: new Date("2026-01-01T00:00:00Z") } });
    await expect(finalizeAssessment("project", 1, f)).rejects.toThrow("仍有材料待审核");
    await prisma.deliverable.updateMany({ data: { reviewStatus: "APPROVED" } });
    await expect(finalizeAssessment("project", 1, f)).rejects.toThrow("saved=1");
    const a = await prisma.quarterAssessment.findUniqueOrThrow({ where: { projectId_quarter: { projectId: "project", quarter: 1 } } });
    expect(a.kpiBonusCny).toBe(2244);
  });
  it("续约期独立于原合同；提前结束按已服务回款月数；已发放不重复计入", async () => {
    await prisma.project.update({ where: { id: "project" }, data: { startDate: "2026-01-01", renewalStatus: "RENEWED", renewalMonths: 6 } });
    let pay = await getPmPay("pm", endOfDayBj("2026-04-01"));
    expect(pay.renewals[0]).toMatchObject({ payable: false, periodEnd: null });
    await expect(saveRenewalTerms(form({ projectId: "project", renewalSignedDate: "2026-03-15", renewalStartDate: "2026-04-01", renewalServedPaidMonths: "", renewalReceivedCny: "" }))).rejects.toThrow("saved=1");
    pay = await getPmPay("pm", endOfDayBj("2026-04-01"));
    expect(pay.renewals[0]).toMatchObject({ periodEnd: "2026-09-27", payable: false });
    await prisma.project.update({ where: { id: "project" }, data: { status: "TERMINATED", terminationDate: "2026-05-30" } });
    await expect(saveRenewalTerms(form({ projectId: "project", renewalSignedDate: "2026-03-15", renewalStartDate: "2026-04-01", renewalServedPaidMonths: 2, renewalReceivedCny: 44880 }))).rejects.toThrow("saved=1");
    pay = await getPmPay("pm", now);
    expect(pay.renewals[0]).toMatchObject({ payable: true, periodEnd: "2026-05-30", bonusCny: 1496 });
    await expect(setRenewalPaid(form({ projectId: "project", pmId: "pm", paid: 1 }))).rejects.toThrow("saved=1");
    pay = await getPmPay("pm", now);
    expect(pay.renewalTotal).toBe(0);
    expect(pay.renewals[0].bonusCny).toBe(1496);
  });
  it("超过 90 天或未核实回款不能发续约奖；停用账号与离职分开", async () => {
    await prisma.project.update({ where: { id: "project" }, data: { startDate: "2026-01-01", renewalStatus: "RENEWED", renewalMonths: 3, renewalSignedDate: "2026-07-15", renewalStartDate: "2026-08-01" } });
    expect((await getPmPay("pm", now)).renewals[0]).toMatchObject({ payable: false, bonusCny: 0 });
    await expect(setRenewalPaid(form({ projectId: "project", pmId: "pm", paid: 1 }))).rejects.toThrow("超过上期结束后");
    await prisma.project.update({ where: { id: "project" }, data: { startDate: "2026-10-01", renewalStatus: null } });
    await prisma.user.update({ where: { id: "pm" }, data: { active: false } });
    expect((await getPmPay("pm", now)).projects[0].bonusPending).toBe(true);
    await expect(saveDepartureDate(form({ userId: "pm", departedOn: "2026-10-15" }))).rejects.toThrow("saved=1");
    const pay = await getPmPay("pm", now);
    expect(pay.commissionTotal).toBe(2244);
    expect(pay.projects[0].bonusPending).toBe(false);
    expect((await getPmPay("pm", endOfDayBj("2026-11-01")))).toMatchObject({ commissionTotal: 0 });
  });
});
