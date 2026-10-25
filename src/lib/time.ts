/**
 * 时间工具：系统内所有截止时间按北京时间（UTC+8，无夏令时）计算。
 * 日期统一用 YYYY-MM-DD 字符串表示“北京时间的某一天”。
 */
export const BJ_OFFSET_MS = 8 * 3600 * 1000;
export const DAY_MS = 86_400_000;

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = ymdToUtcMidnight(s);
  // 2026-13-40 这类会被 Date.UTC 进位，往返一次确认是真实日期
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** YYYY-MM-DD → 该日 00:00 UTC 的毫秒数（只用于日期算术） */
export function ymdToUtcMidnight(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtcMidnight(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** a − b 的天数 */
export function diffDays(a: string, b: string): number {
  return Math.round((ymdToUtcMidnight(a) - ymdToUtcMidnight(b)) / DAY_MS);
}

/** 0 = 周日 … 1 = 周一 … 6 = 周六 */
export function weekday(ymd: string): number {
  return new Date(ymdToUtcMidnight(ymd)).getUTCDay();
}

/** 北京时间当天 00:00:00.000 */
export function startOfDayBj(ymd: string): Date {
  return new Date(ymdToUtcMidnight(ymd) - BJ_OFFSET_MS);
}

/** 北京时间当天 23:59:59.999 */
export function endOfDayBj(ymd: string): Date {
  return new Date(ymdToUtcMidnight(ymd) + DAY_MS - 1 - BJ_OFFSET_MS);
}

/** 某个时刻在北京时间属于哪一天 */
export function toBjYmd(d: Date): string {
  return new Date(d.getTime() + BJ_OFFSET_MS).toISOString().slice(0, 10);
}

/** 北京时间 "YYYY-MM-DD HH:mm" */
export function formatBj(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d.getTime() + BJ_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

export function formatBjDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return toBjYmd(d);
}

/**
 * 延期天数：首次提交时间 − 截止时间，按 24 小时向上取整。
 * 截止后 1 分钟提交也算延期 1 天。
 */
export function lateDays(dueAt: Date, submittedAt: Date): number {
  const diff = submittedAt.getTime() - dueAt.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

export const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
