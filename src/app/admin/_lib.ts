import { redirect } from "next/navigation";
import type { Submission } from "@prisma/client";
import type { z } from "zod";
import { clearSession, getSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quarterOfDate } from "@/lib/rules";
import { addDays, endOfDayBj, formatBj, startOfDayBj, toBjYmd, weekday } from "@/lib/time";

/** 会话令牌 7 天内不会自动失效：按数据库现状复核账号是否仍启用、角色是否变了 */
export async function accountState(uid: string): Promise<{ role: string; active: boolean } | null> {
  return prisma.user.findUnique({ where: { id: uid }, select: { role: true, active: true } });
}

/** Server Action 里统一校验：未登录去登录页；账号已停用则清掉会话；非管理员（含被降级的）直接拒绝 */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  const acct = await accountState(s.uid);
  if (!acct || !acct.active) {
    await clearSession();
    redirect("/login");
  }
  if (s.role !== "ADMIN" || acct.role !== "ADMIN") throw new Error("无权操作：仅管理员可执行此操作");
  return s;
}

/** 在路径上设置/删除查询参数，保留 #锚点 */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const [base, hash] = path.split("#");
  const [pathname, qs] = base.split("?");
  const sp = new URLSearchParams(qs ?? "");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const q = sp.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
}

/** 带错误信息跳回表单页 */
export function failTo(path: string, message: string): never {
  redirect(withQuery(path, { error: message, saved: null }));
}

/** 只允许站内相对路径作为返回地址 */
export function safeBack(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  // 禁止 //host 与 /\host（浏览器会把反斜杠当斜杠解析成外部地址）
  return /^\/(?![\/\\])/.test(s) ? s : fallback;
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "输入有误";
}

/** 项目当前所处考核季度：按日期算，并夹在 1 … ⌈合同月数/3⌉ 之间（合同期已过时停在最后一季，不给不存在的季度打 100%） */
export function currentQuarter(project: { startDate: string; contractMonths: number }, now: Date = new Date()): number {
  const raw = quarterOfDate(project.startDate, toBjYmd(now));
  const max = Math.max(1, Math.ceil(project.contractMonths / 3));
  return Math.min(Math.max(raw, 1), max);
}

export function isOverdue(d: { dueAt: Date; firstSubmittedAt: Date | null }, now: Date): boolean {
  return !d.firstSubmittedAt && d.dueAt.getTime() < now.getTime();
}

/** 北京时间本周（周一 00:00 — 周日 23:59:59） */
export function bjWeekRange(now: Date): { start: Date; end: Date; startYmd: string; endYmd: string } {
  const today = toBjYmd(now);
  const offset = (weekday(today) + 6) % 7; // 周一 = 0
  const startYmd = addDays(today, -offset);
  const endYmd = addDays(startYmd, 6);
  return { start: startOfDayBj(startYmd), end: endOfDayBj(endYmd), startYmd, endYmd };
}

/** 还在跑的项目状态（已终止/已完成不再计逾期） */
export const RUNNING_STATUSES = ["ACTIVE", "PAUSED"] as const;

export const RENEWAL_STATUSES = [
  { value: "NONE", label: "未开始" },
  { value: "IN_PROGRESS", label: "洽谈中" },
  { value: "RENEWED", label: "已续约" },
  { value: "LOST", label: "未续约" },
] as const;

export const REVIEW_STATUSES = [
  { value: "PENDING", label: "待审核" },
  { value: "REJECTED", label: "审核不通过" },
  { value: "APPROVED", label: "审核通过" },
] as const;

/** 节点形式：FILE 文件 / TEXT 文字 / TIMELINE 在 timeline 页维护条目 */
export function kindLabel(kind: string): string {
  if (kind === "FILE") return "文件";
  if (kind === "TEXT") return "文字";
  if (kind === "TIMELINE") return "timeline";
  return kind;
}

/** timeline 条目的延期说明：超期/迟完成 N 天，宽限后按 M 天扣 */
export function timelineLateText(s: { status: string; lateDays: number; penaltyDays: number; graceDays: number }): string {
  if (s.lateDays === -1) return "未完成，扣满";
  if (s.lateDays === 0) return s.status === "DONE" ? "按时完成" : "";
  const verb = s.status === "DONE" ? "迟完成" : "超期";
  if (s.penaltyDays > 0) return `${verb} ${s.lateDays} 天（宽限 ${s.graceDays} 天后按 ${s.penaltyDays} 天扣）`;
  return `${verb} ${s.lateDays} 天（宽限 ${s.graceDays} 天内，不扣）`;
}

export function projectStatusTone(status: string): "green" | "amber" | "red" | "zinc" | "neutral" {
  if (status === "ACTIVE") return "green";
  if (status === "PAUSED") return "amber";
  if (status === "TERMINATED") return "red";
  if (status === "COMPLETED") return "zinc";
  return "neutral";
}

/** 各项目已逾期未提交节点数 */
export async function overdueCountByProject(now: Date): Promise<Map<string, number>> {
  const rows = await prisma.deliverable.groupBy({
    by: ["projectId"],
    where: { firstSubmittedAt: null, dueAt: { lt: now } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.projectId, r._count._all]));
}

export type LatestSubmission = Pick<Submission, "id" | "version" | "textContent" | "fileName" | "fileSize" | "submittedAt" | "note"> & {
  submittedBy: { name: string };
};

/** 每个节点的最新一次提交 */
export async function latestSubmissionsFor(deliverableIds: string[]): Promise<Map<string, LatestSubmission>> {
  if (deliverableIds.length === 0) return new Map();
  const subs = await prisma.submission.findMany({
    where: { deliverableId: { in: deliverableIds } },
    orderBy: [{ submittedAt: "desc" }, { version: "desc" }],
    select: {
      id: true,
      deliverableId: true,
      version: true,
      textContent: true,
      fileName: true,
      fileSize: true,
      submittedAt: true,
      note: true,
      submittedBy: { select: { name: true } },
    },
  });
  const map = new Map<string, LatestSubmission>();
  for (const s of subs) if (!map.has(s.deliverableId)) map.set(s.deliverableId, s);
  return map;
}

/** datetime-local 的值按北京时间解释 */
export function parseBjDateTimeLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toBjDateTimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  return formatBj(d).replace(" ", "T");
}

export function fileSizeText(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
