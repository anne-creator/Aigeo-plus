import { describe, expect, it } from "vitest";
import { baseSalaryByHours, monthlyCommission, renewalBonus } from "../pay";
import { commissionEligible, commissionFromReceipt, currentServiceMonth, kpiStopped, renewalWithinWindow, occurredBeforeDeparture } from "../compensation";

const cfg = { fxRate: 6.8, commissionRate: 0.1 };

describe("底薪分档（PDF）", () => {
  it("不足 4 小时没有底薪；分界点归高一档", () => {
    expect(baseSalaryByHours(3.9).salary).toBe(0);
    expect(baseSalaryByHours(4).salary).toBe(4000);
    expect(baseSalaryByHours(5.9).salary).toBe(4000);
    expect(baseSalaryByHours(6).salary).toBe(8000);
    expect(baseSalaryByHours(8).salary).toBe(12000);
    expect(baseSalaryByHours(11).salary).toBe(12000);
  });

});

describe("实际回款与停发边界", () => {
  const project = { startDate: "2026-10-01", contractMonths: 3, status: "ACTIVE", terminationDate: null as string | null };
  it("10% 按实际人民币金额计算，保留到分", () => {
    expect(commissionFromReceipt(14000)).toBe(1400);
    expect(commissionFromReceipt(22440.12)).toBe(2244.01);
  });
  it("30 天服务月的首尾，不多算一个月", () => {
    expect(currentServiceMonth(project, "2026-09-30")).toBeNull();
    expect(currentServiceMonth(project, "2026-10-30")).toBe(1);
    expect(currentServiceMonth(project, "2026-10-31")).toBe(2);
    expect(currentServiceMonth(project, "2026-12-30")).toBeNull();
  });
  it("暂停、终止当月保留提成，下月停发，当季奖金停发", () => {
    for (const status of ["PAUSED", "TERMINATED"]) {
      const stopped = { ...project, status, terminationDate: "2026-10-15" };
      expect(commissionEligible(stopped, 1)).toBe(true);
      expect(commissionEligible(stopped, 2)).toBe(false);
      expect(kpiStopped(stopped, 1)).toBe(true);
    }
  });
  it("离职只保留已经开始的服务月提成", () => {
    expect(occurredBeforeDeparture(project.startDate, 1, "2026-10-15")).toBe(true);
    expect(occurredBeforeDeparture(project.startDate, 2, "2026-10-15")).toBe(false);
  });
  it("续约签约 90 天内（含）有效，也支持提前签约", () => {
    expect(renewalWithinWindow("2026-01-01", "2026-04-01")).toBe(true);
    expect(renewalWithinWindow("2026-01-01", "2026-04-02")).toBe(false);
    expect(renewalWithinWindow("2026-01-01", "2025-12-01")).toBe(true);
  });
});

describe("月提成与续约奖（PDF 示例）", () => {
  it("$2,000 → ¥1,360；$3,300 → ¥2,244", () => {
    expect(monthlyCommission(2000, cfg)).toBe(1360);
    expect(monthlyCommission(3300, cfg)).toBe(2244);
  });
  it("每续约 3 个月奖 1 个月提成", () => {
    expect(Math.round(renewalBonus(2000, 1, cfg))).toBe(453);
    expect(renewalBonus(2000, 3, cfg)).toBe(1360);
    expect(renewalBonus(2000, 6, cfg)).toBe(2720);
    expect(renewalBonus(2000, 12, cfg)).toBe(5440);
    expect(Math.round(renewalBonus(3300, 1, cfg))).toBe(748);
    expect(renewalBonus(3300, 12, cfg)).toBe(8976);
  });
  it("PDF 收入示例：3 个 $3,300 + 5 个 $2,000，6–8 小时 → 每月固定 ¥21,532", () => {
    const commission = 3 * monthlyCommission(3300, cfg) + 5 * monthlyCommission(2000, cfg);
    expect(commission).toBe(13532);
    expect(baseSalaryByHours(7).salary + commission).toBe(21532);
  });
});
