"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_TASK_MINUTES, MAX_TASK_MINUTES } from "@/lib/minutes";
import { prisma } from "@/lib/db";
import { endOfDayBj, isYmd } from "@/lib/time";
import { failTo, firstIssue, requireAdmin, str, withQuery } from "../_lib";

const BACK = "/admin/interns";

function done(): never {
  revalidatePath("/", "layout");
  redirect(withQuery(BACK, { saved: 1 }));
}

const emptyToNull = (s: string) => (s === "" ? null : s);

export async function createInternTask(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const parsed = z
    .object({
      assigneeId: z.string().min(1, "请选择负责人"),
      projectId: z.string().trim().transform(emptyToNull),
      title: z.string().trim().min(1, "任务标题必填").max(200, "标题过长"),
      description: z.string().trim().max(2000, "说明过长").transform(emptyToNull),
      dueDate: z
        .string()
        .trim()
        .transform(emptyToNull)
        .refine((s) => s === null || isYmd(s), "截止日期格式不正确"),
      estimatedMinutes: z.coerce.number().int().min(0, "预计用时不能为负").max(MAX_TASK_MINUTES, `预计用时不超过 ${MAX_TASK_MINUTES} 分钟`),
    })
    .safeParse({
      assigneeId: str(formData, "assigneeId"),
      projectId: str(formData, "projectId"),
      title: str(formData, "title"),
      description: str(formData, "description"),
      dueDate: str(formData, "dueDate"),
      estimatedMinutes: str(formData, "estimatedMinutes") || String(DEFAULT_TASK_MINUTES),
    });
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const v = parsed.data;
  const assignee = await prisma.user.findUnique({ where: { id: v.assigneeId }, select: { role: true, active: true } });
  if (!assignee || assignee.role !== "INTERN") failTo(BACK, "所选账号不是负责人");
  if (!assignee.active) failTo(BACK, "该负责人账号已停用");
  if (v.projectId) {
    const project = await prisma.project.findUnique({ where: { id: v.projectId }, select: { id: true } });
    if (!project) failTo(BACK, "所选客户不存在");
  }
  await prisma.internTask.create({
    data: {
      assigneeId: v.assigneeId,
      createdById: session.uid,
      projectId: v.projectId,
      title: v.title,
      description: v.description,
      // 截止：北京时间当天 23:59:59
      dueAt: v.dueDate ? endOfDayBj(v.dueDate) : null,
      estimatedMinutes: v.estimatedMinutes,
    },
  });
  done();
}

export async function setInternTaskStatus(id: string, status: "TODO" | "DONE"): Promise<void> {
  await requireAdmin();
  if (status !== "TODO" && status !== "DONE") failTo(BACK, "无效状态");
  const task = await prisma.internTask.findUnique({ where: { id }, select: { id: true } });
  if (!task) failTo(BACK, "任务不存在");
  await prisma.internTask.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  done();
}

export async function deleteInternTask(id: string): Promise<void> {
  await requireAdmin();
  const task = await prisma.internTask.findUnique({ where: { id }, select: { id: true } });
  if (!task) failTo(BACK, "任务不存在");
  await prisma.internTask.delete({ where: { id } });
  done();
}
