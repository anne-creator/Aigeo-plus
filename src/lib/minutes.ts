/** 任务预计用时（分钟）的常量与格式化。不依赖数据库，客户端组件也可以引用。 */

export const MAX_TASK_MINUTES = 180;
export const TASK_MINUTES_STEP = 5;
export const DEFAULT_TASK_MINUTES = 30;

/** 收进 0–180 的整数分钟；不是数字时返回 null */
export function clampMinutes(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(MAX_TASK_MINUTES, Math.round(n)));
}

/** 45 → “45 分钟”；90 → “1 小时 30 分钟”；120 → “2 小时” */
export function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return "未填";
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} 小时 ${r} 分钟` : `${h} 小时`;
}
