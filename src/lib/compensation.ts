/** 《项目经理薪酬规则》2026-10-19。纯计算，金额统一保留到分。 */
import { projectEndDate, quarterOfDate, round2, serviceMonthOfDate } from "./rules";
import { addDays, diffDays } from "./time";

export const COMMISSION_RATE = 0.1;
export const LARGE_PROJECT_THRESHOLD_USD = 5000;
export const SALARY_TIERS = [
  { minHours: 8, salary: 12000, label: "日均 8 小时及以上" },
  { minHours: 6, salary: 8000, label: "日均 6–8 小时" },
  { minHours: 4, salary: 4000, label: "日均 4–6 小时" },
] as const;

export function salaryForHours(hours: number) {
  const tier = SALARY_TIERS.find((t) => hours >= t.minHours);
  return tier ? { salary: tier.salary, label: tier.label } : { salary: 0, label: "日均不足 4 小时" };
}

export function commissionFromReceipt(cny: number) { return round2(cny * COMMISSION_RATE); }

type ServiceProject = { startDate: string; contractMonths: number; status: string; terminationDate: string | null };
export function servicePeriod(startDate: string, month: number) {
  return { start: addDays(startDate, (month - 1) * 30), end: projectEndDate(startDate, month) };
}

/** 暂停/终止当月仍结算已经发生的提成；下一服务月起停止。 */
export function commissionEligible(p: ServiceProject, serviceMonth: number) {
  if (serviceMonth < 1 || serviceMonth > p.contractMonths) return false;
  if (["PAUSED", "TERMINATED"].includes(p.status)) {
    if (!p.terminationDate) return false;
    return serviceMonth <= serviceMonthOfDate(p.startDate, p.terminationDate);
  }
  return true;
}

export function currentServiceMonth(p: ServiceProject, today: string) {
  const month = serviceMonthOfDate(p.startDate, today);
  return month >= 1 && month <= p.contractMonths ? month : null;
}

export function kpiStopped(p: ServiceProject, quarter: number) {
  return ["PAUSED", "TERMINATED"].includes(p.status)
    && (!p.terminationDate || quarterOfDate(p.startDate, p.terminationDate) <= quarter);
}

export function renewalWithinWindow(originalEnd: string, signedDate: string) {
  return diffDays(signedDate, originalEnd) <= 90;
}

export function occurredBeforeDeparture(startDate: string, month: number, departedOn: string | null) {
  return !departedOn || servicePeriod(startDate, month).start <= departedOn;
}
