import "server-only";
import type { Prisma } from "@prisma/client";
import type { Session } from "@/lib/auth";
import { clampMinutes, type DraftTask } from "@/lib/tasks";
import { isYmd, lateDays } from "@/lib/time";

export const TASKS_HREF = "/pm/tasks";
export const batchHref = (id: string) => `${TASKS_HREF}/${id}`;

/** 能分配任务的项目状态 */
export const ASSIGNABLE_STATUSES = ["ACTIVE", "PAUSED"];

/** 一份清单最多多少条 */
export const MAX_ITEMS = 200;

/** PM 只看自己名下项目；ADMIN 看全部 */
export function projectScope(session: Session): Prisma.ProjectWhereInput {
  return session.role === "ADMIN" ? {} : { pmId: session.uid };
}

export function sp(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** 2026-10-25 → 10/25 */
export function shortYmd(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
}

/** 从审核页表单读回清单：item_<i>_title / item_<i>_date / item_<i>_minutes / item_<i>_note / item_<i>_remove */
export function itemsFromForm(formData: FormData): DraftTask[] {
  const count = Math.min(Number(formData.get("count")) || 0, MAX_ITEMS + 10);
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const items: DraftTask[] = [];
  for (let i = 0; i < count; i++) {
    if (formData.get(`item_${i}_remove`)) continue;
    const title = str(`item_${i}_title`).slice(0, 300);
    if (!title) continue;
    const date = str(`item_${i}_date`);
    const note = str(`item_${i}_note`).slice(0, 1000);
    const estimatedMinutes = clampMinutes(str(`item_${i}_minutes`));
    items.push({ title, dueDate: isYmd(date) ? date : null, note: note || null, estimatedMinutes });
  }
  return items;
}

export type TaskState = { label: string; tone: "green" | "red" | "blue" | "amber" };

/** 已下发任务的状态：待完成 / 已完成 / 超期 N 天 */
export function taskState(t: { status: string; completedAt: Date | null; dueAt: Date | null }, now: Date): TaskState {
  if (t.status === "DONE" || t.completedAt) {
    const late = t.dueAt && t.completedAt ? lateDays(t.dueAt, t.completedAt) : 0;
    return late > 0 ? { label: `已完成 · 迟 ${late} 天`, tone: "amber" } : { label: "已完成", tone: "green" };
  }
  if (t.dueAt && t.dueAt < now) return { label: `超期 ${lateDays(t.dueAt, now)} 天`, tone: "red" };
  return { label: "待完成", tone: "blue" };
}

export function isDone(t: { status: string; completedAt: Date | null }): boolean {
  return t.status === "DONE" || Boolean(t.completedAt);
}
