import type { CalendarEvent } from "@/lib/calendar";
import { addDays, diffDays, weekday, WEEKDAY_CN } from "@/lib/time";

/** 日历里的颜色语义：红=已过期未完成，蓝=今天到期未完成，绿=已完成，灰=未来；琥珀只用于“宽限中”文字 */
export type Tone = "red" | "blue" | "green" | "grey" | "amber";

export const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  DELIVERABLE: "节点",
  TIMELINE: "timeline",
  INTERN_TASK: "任务",
  MEETING: "会议",
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 日历格子里的圆点颜色 */
export function eventTone(e: CalendarEvent, today: string): Tone {
  if (e.kind === "MEETING") return e.date === today && !e.done ? "blue" : "grey";
  if (e.done) return "green";
  if (e.date < today) return "red";
  if (e.date === today) return "blue";
  return "grey";
}

/** 列表里的状态文字 */
export function statusOf(e: CalendarEvent, today: string): { text: string; tone: Tone } {
  if (e.kind === "MEETING") return { text: e.time ?? "会议", tone: e.done ? "grey" : e.date === today ? "blue" : "grey" };
  if (e.done) return { text: "已完成", tone: "green" };
  if (e.date < today) {
    if (e.grace) return { text: "宽限中", tone: "amber" };
    return { text: `超期 ${diffDays(today, e.date)} 天`, tone: "red" };
  }
  return { text: "待完成", tone: e.date === today ? "blue" : "grey" };
}

/** YYYY-MM-DD → YYYY-MM */
export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** 月视图的格子（周一为首列），月外位置为 null，总数是 7 的倍数 */
export function monthCells(ym: string): Array<string | null> {
  const first = `${ym}-01`;
  const days = diffDays(`${shiftMonth(ym, 1)}-01`, first);
  const lead = (weekday(first) + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

/** "10月19日 周一" */
export function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}月${Number(d)}日 ${WEEKDAY_CN[weekday(ymd)]}`;
}
