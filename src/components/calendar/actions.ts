"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessProject, homeFor, requireSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toBjYmd } from "@/lib/time";

const schema = z.object({
  kind: z.enum(["TIMELINE", "INTERN_TASK"], { error: "事件类型不正确" }),
  id: z.string().min(1, "缺少事件 ID"),
  next: z.enum(["DONE", "TODO"], { error: "状态不正确" }),
});

/** 回到发起操作的页面（只取同站路径，去掉旧的 error 参数）；没有 referer 就回角色首页 */
async function backPath(session: Session): Promise<string> {
  const ref = (await headers()).get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      u.searchParams.delete("error");
      const q = u.searchParams.toString();
      return `${u.pathname}${q ? `?${q}` : ""}`;
    } catch {
      // 非法 referer，忽略
    }
  }
  return homeFor(session.role);
}

function withError(path: string, msg: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`;
}

/**
 * 日历 checklist 勾选 / 撤销。
 * 表单字段：kind（TIMELINE | INTERN_TASK）、id、next（DONE | TODO）
 * - TIMELINE：项目的 PM 或 ADMIN；勾选 = 记完成时间与完成人；PM 只能撤销当天勾选的，ADMIN 不限
 * - INTERN_TASK：任务的 assignee 本人或 ADMIN
 */
export async function toggleEvent(formData: FormData): Promise<void> {
  const session = await requireSession();
  const back = await backPath(session);
  const parsed = schema.safeParse({ kind: formData.get("kind"), id: formData.get("id"), next: formData.get("next") });
  if (!parsed.success) redirect(withError(back, parsed.error.issues[0]?.message ?? "参数不正确"));
  const { kind, id, next } = parsed.data;
  const now = new Date();

  if (kind === "TIMELINE") {
    const item = await prisma.timelineItem.findUnique({ where: { id }, include: { project: { select: { pmId: true } } } });
    if (!item) redirect(withError(back, "条目不存在或已被删除"));
    if (!canAccessProject(session, item.project)) redirect(withError(back, "无权操作该条目"));
    if (next === "DONE") {
      if (!item.completedAt) {
        await prisma.timelineItem.update({ where: { id }, data: { completedAt: now, completedById: session.uid } });
      }
    } else if (item.completedAt) {
      if (session.role !== "ADMIN" && toBjYmd(item.completedAt) !== toBjYmd(now)) {
        redirect(withError(back, "只能撤销当天勾选的条目，隔天请联系管理员"));
      }
      await prisma.timelineItem.update({ where: { id }, data: { completedAt: null, completedById: null } });
    }
  } else {
    const task = await prisma.internTask.findUnique({ where: { id } });
    if (!task) redirect(withError(back, "任务不存在或已被删除"));
    if (task.assigneeId !== session.uid && session.role !== "ADMIN") redirect(withError(back, "无权操作该任务"));
    if (task.status !== next) {
      await prisma.internTask.update({
        where: { id },
        data: { status: next, completedAt: next === "DONE" ? new Date() : null },
      });
    }
  }

  revalidatePath("/", "layout");
  redirect(back);
}
