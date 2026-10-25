"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { quarterOfDate } from "@/lib/rules";
import { isYmd } from "@/lib/time";
import { markTimelineSubmitted } from "@/lib/timeline";
import { failTo, firstIssue, requireAdmin, str, withQuery } from "../../_lib";

/** 管理员维护项目 timeline 条目（PM 上传的详细节点计划）。管理员可改任何条目；已结算季度的条目要先撤销结算。 */

const itemSchema = z.object({
  title: z.string().trim().min(1, "事项必填").max(200, "事项过长（最多 200 字）"),
  dueDate: z.string().trim().refine(isYmd, "日期格式须为 YYYY-MM-DD"),
});

function anchor(projectId: string): string {
  return `/admin/projects/${projectId}#project-timeline`;
}

async function loadProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, startDate: true } });
  if (!project) failTo("/admin/projects", "项目不存在");
  return project;
}

/** 条目截止日所在季度已结算固化：数字已冻结，不再允许改动 */
async function assertQuarterOpen(project: { id: string; startDate: string }, dueDate: string, back: string): Promise<void> {
  const quarter = quarterOfDate(project.startDate, dueDate);
  if (quarter < 1) return;
  const a = await prisma.quarterAssessment.findUnique({
    where: { projectId_quarter: { projectId: project.id, quarter } },
    select: { finalizedAt: true },
  });
  if (a?.finalizedAt) failTo(back, `第 ${quarter} 季度已结算固化，请先撤销结算再改 timeline`);
}

async function loadItem(projectId: string, itemId: string, back: string) {
  const item = await prisma.timelineItem.findUnique({ where: { id: itemId } });
  if (!item || item.projectId !== projectId) failTo(back, "条目不存在");
  return item;
}

function done(projectId: string): never {
  revalidatePath("/", "layout");
  redirect(withQuery(anchor(projectId), { saved: 1 }));
}

/* ---------------------------------- 添加 ---------------------------------- */

export async function addTimelineItem(projectId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const back = anchor(projectId);
  const project = await loadProject(projectId);
  const parsed = itemSchema.safeParse({ title: str(formData, "title"), dueDate: str(formData, "dueDate") });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  await assertQuarterOpen(project, v.dueDate, back);
  const max = await prisma.timelineItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
  await prisma.timelineItem.create({
    data: { projectId, title: v.title, dueDate: v.dueDate, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: session.uid },
  });
  await markTimelineSubmitted(projectId, session.uid, `管理员添加条目：${v.dueDate} ${v.title}`);
  done(projectId);
}

/* ---------------------------------- 编辑 ---------------------------------- */

export async function updateTimelineItem(projectId: string, itemId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const back = anchor(projectId);
  const project = await loadProject(projectId);
  const item = await loadItem(projectId, itemId, back);
  const parsed = itemSchema.safeParse({ title: str(formData, "title"), dueDate: str(formData, "dueDate") });
  if (!parsed.success) failTo(back, firstIssue(parsed.error));
  const v = parsed.data;
  await assertQuarterOpen(project, item.dueDate, back);
  if (v.dueDate !== item.dueDate) await assertQuarterOpen(project, v.dueDate, back);
  await prisma.timelineItem.update({ where: { id: itemId }, data: { title: v.title, dueDate: v.dueDate } });
  done(projectId);
}

/* -------------------------------- 完成 / 撤销 -------------------------------- */

export async function toggleTimelineItem(projectId: string, itemId: string, complete: boolean): Promise<void> {
  const session = await requireAdmin();
  const back = anchor(projectId);
  const project = await loadProject(projectId);
  const item = await loadItem(projectId, itemId, back);
  await assertQuarterOpen(project, item.dueDate, back);
  await prisma.timelineItem.update({
    where: { id: itemId },
    data: complete ? { completedAt: new Date(), completedById: session.uid } : { completedAt: null, completedById: null },
  });
  done(projectId);
}

/* ---------------------------------- 删除 ---------------------------------- */

export async function deleteTimelineItem(projectId: string, itemId: string): Promise<void> {
  await requireAdmin();
  const back = anchor(projectId);
  const project = await loadProject(projectId);
  const item = await loadItem(projectId, itemId, back);
  await assertQuarterOpen(project, item.dueDate, back);
  await prisma.timelineItem.delete({ where: { id: itemId } });
  done(projectId);
}
