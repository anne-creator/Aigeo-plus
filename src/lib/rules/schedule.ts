import { addDays, diffDays, endOfDayBj, startOfDayBj, weekday } from "@/lib/time";
import { DEFAULT_RULES, DELIVERABLE_META } from "./defaults";
import type { DeliverableCode, ScheduleInput, ScheduledDeliverable } from "./types";

/** 项目结束日（含）：D0 + 30 × 合同月数 − 1 */
export function projectEndDate(startDate: string, contractMonths: number): string {
  return addDays(startDate, 30 * contractMonths - 1);
}

/** 某个北京日期属于项目的第几季度（1 起）；早于 D0 返回 0 */
export function quarterOfDate(startDate: string, ymd: string): number {
  const d = diffDays(ymd, startDate);
  if (d < 0) return 0;
  return Math.floor(d / 90) + 1;
}

/** 某个北京日期属于项目的第几个服务月（1 起） */
export function serviceMonthOfDate(startDate: string, ymd: string): number {
  const d = diffDays(ymd, startDate);
  if (d < 0) return 0;
  return Math.floor(d / 30) + 1;
}

/** 第一次周一复盘的日期：D0 + 7 之后（含）的第一个周一 */
export function firstWeeklyUpdateDate(startDate: string): string {
  let d = addDays(startDate, 7);
  while (weekday(d) !== 1) d = addDays(d, 1);
  return d;
}

function make(
  code: DeliverableCode,
  seq: number,
  periodLabel: string,
  quarter: number,
  windowStartYmd: string,
  dueYmd: string,
): ScheduledDeliverable {
  const meta = DELIVERABLE_META[code];
  return {
    code,
    seq,
    title: seq === 1 && !["WEEKLY_UPDATE", "MONTHLY_REPORT", "DISTRIBUTION_LIST", "QUARTER_REPORT"].includes(code)
      ? meta.name
      : `${meta.name} · ${periodLabel}`,
    kind: meta.kind,
    periodLabel,
    quarter,
    windowStartYmd,
    dueYmd,
    windowStart: startOfDayBj(windowStartYmd),
    dueAt: endOfDayBj(dueYmd),
  };
}

/**
 * 按规则说明第 3 节生成一个项目的全部交付节点。
 * 纯函数，不依赖当前时间。
 */
export function buildSchedule(input: ScheduleInput): ScheduledDeliverable[] {
  const { startDate, contractMonths } = input;
  const cfg = {
    monthlyReportWindowDays: input.config?.monthlyReportWindowDays ?? DEFAULT_RULES.monthlyReportWindowDays,
    quarterReportWindowDays: input.config?.quarterReportWindowDays ?? DEFAULT_RULES.quarterReportWindowDays,
  };
  const enabled = (code: DeliverableCode): boolean =>
    input.config?.deliverables?.[code]?.enabled ?? DEFAULT_RULES.deliverables[code].enabled ?? true;
  if (!Number.isInteger(contractMonths) || contractMonths < 1) return [];
  const D0 = startDate;
  const endYmd = projectEndDate(D0, contractMonths);
  const items: ScheduledDeliverable[] = [];

  // 一次性节点（都属于第 1 季度）
  items.push(make("PROMPT_POOL", 1, "第 1 天", 1, D0, D0));
  items.push(make("BASELINE_PLAN", 1, "第 1 周", 1, D0, addDays(D0, 6)));
  items.push(make("SITE_CHECKLIST", 1, "第 2–3 周", 1, addDays(D0, 7), addDays(D0, 20)));
  items.push(make("KNOWLEDGE_BASE", 1, "第 2–3 周", 1, addDays(D0, 7), addDays(D0, 20)));
  // 项目 timeline：基线报告（第 1 周）确认后录入，第 2 周结束前完成首次录入；窗口从 D0 开放
  items.push(make("PROJECT_TIMELINE", 1, "第 2 周", 1, D0, addDays(D0, 13)));

  // 每周一复盘：从 D0+7 之后的第一个周一起，到项目结束日为止；窗口从前一个周六 00:00 开放，便于周末准备
  let monday = firstWeeklyUpdateDate(D0);
  let w = 1;
  while (diffDays(monday, endYmd) <= 0) {
    items.push(make("WEEKLY_UPDATE", w, `第 ${w} 次 · ${monday}`, quarterOfDate(D0, monday), addDays(monday, -2), monday));
    monday = addDays(monday, 7);
    w += 1;
  }

  // 月报 + 分发清单：服务月 M 为 [D0+30(M−1), D0+30M−1]，结束后 windowDays 天内提交
  for (let m = 1; m <= contractMonths; m++) {
    const open = addDays(D0, 30 * m);
    const due = addDays(D0, 30 * m + cfg.monthlyReportWindowDays - 1);
    const q = Math.ceil(m / 3);
    items.push(make("MONTHLY_REPORT", m, `第 ${m} 个服务月`, q, open, due));
    items.push(make("DISTRIBUTION_LIST", m, `第 ${m} 个服务月`, q, open, due));
  }

  // 季末报告：季度 Q 为 [D0+90(Q−1), D0+90Q−1]，结束后 windowDays 天内提交
  const quarters = Math.floor(contractMonths / 3);
  for (let q = 1; q <= quarters; q++) {
    const open = addDays(D0, 90 * q);
    const due = addDays(D0, 90 * q + cfg.quarterReportWindowDays - 1);
    items.push(make("QUARTER_REPORT", q, `第 ${q} 季度`, q, open, due));
  }

  // 建议项：续约推进计划 —— 项目结束前 30 天截止，窗口提前 14 天开放（合同 ≥ 2 个月才有意义）
  if (enabled("RENEWAL_PLAN") && contractMonths >= 2) {
    const due = addDays(endYmd, -30);
    items.push(make("RENEWAL_PLAN", 1, `结束前 30 天 · ${due}`, quarterOfDate(D0, due), addDays(due, -14), due));
  }

  // 建议项：新季度规划 —— 第 2 季度起，每季开始后 7 天内提交（与基线方案的 7 天窗口一致）
  if (enabled("QUARTER_PLAN")) {
    const lastQuarter = Math.ceil(contractMonths / 3);
    for (let q = 2; q <= lastQuarter; q++) {
      const open = addDays(D0, 90 * (q - 1));
      items.push(make("QUARTER_PLAN", q, `第 ${q} 季度`, q, open, addDays(open, 6)));
    }
  }

  // 暂停/终止：截止日晚于终止日的节点不再要求
  const cutoff = input.terminationDate;
  const kept = items
    .filter((it) => enabled(it.code))
    .filter((it) => (cutoff ? diffDays(it.dueYmd, cutoff) <= 0 : true));

  // 所有节点从 D0 起开放，可以提前、跳步提交；只按截止日算延期
  for (const it of kept) {
    it.windowStartYmd = D0;
    it.windowStart = startOfDayBj(D0);
  }

  return kept.sort(
    (a, b) =>
      a.dueAt.getTime() - b.dueAt.getTime() ||
      DELIVERABLE_META[a.code].order - DELIVERABLE_META[b.code].order ||
      a.seq - b.seq,
  );
}

export function scheduleKey(d: { code: string; seq: number }): string {
  return `${d.code}#${d.seq}`;
}
