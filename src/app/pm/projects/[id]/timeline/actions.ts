"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessProject, requireSession, type Session } from "@/lib/auth";
import { fileFromForm, discardImportedFile } from "@/lib/files";
import { prisma } from "@/lib/db";
import { diffSummary, diffTimeline, markTimelineSubmitted } from "@/lib/timeline";
import { organizeTimelineDocument } from "@/lib/timeline-document";
import { validateTimelineRows, TIMELINE_MAX_TEXT, type TimelineImportResult } from "@/lib/timeline-import";
import { projectEndDate } from "@/lib/rules";
import { isYmd, toBjYmd } from "@/lib/time";
import { canEditTimelineItem, canUndoTimelineItem, isLiveStatus, timelineHref } from "../../../_lib";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function back(projectId: string, q: Record<string, string>): never {
  const qs = new URLSearchParams(q).toString();
  revalidatePath("/", "layout");
  redirect(`${timelineHref(projectId)}${qs ? `?${qs}` : ""}`);
}

/** 项目必须属于当前 PM（ADMIN 不限）且仍在进行中（ADMIN 不限） */
async function loadProject(session: Session, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, pmId: true, status: true, startDate: true, contractMonths: true } });
  if (!project || !canAccessProject(session, project)) return { project: null, error: "项目不存在或无权操作" };
  if (session.role !== "ADMIN" && !isLiveStatus(project.status)) return { project: null, error: "项目已终止或完成，不能再改 timeline" };
  return { project, error: null };
}

/** 条目必须属于该项目且当前用户可操作该项目 */
async function loadItem(session: Session, projectId: string, itemId: string) {
  const item = await prisma.timelineItem.findUnique({ where: { id: itemId }, include: { project: { select: { id: true, pmId: true, status: true } } } });
  if (!item || item.projectId !== projectId || !canAccessProject(session, item.project)) return { item: null, error: "条目不存在或无权操作" };
  if (session.role !== "ADMIN" && !isLiveStatus(item.project.status)) return { item: null, error: "项目已终止或完成，不能再改 timeline" };
  return { item, error: null };
}

export type TimelineFormState = { error: string | null };

/** 识别只返回草稿，不创建节点、提交记录或客户可见内容。 */
export async function importTimelineAction(formData: FormData): Promise<{ error: string | null; result?: TimelineImportResult }> {
  const session = await requireSession(["PM"]);
  const { project, error } = await loadProject(session, str(formData.get("projectId")));
  if (!project) return { error: error ?? "无权操作" };
  let file: File | null = null;
  try {
    file = await fileFromForm(formData, session.uid, "timeline", project.id);
    if (!file) return { error: "请先选择一个 timeline 文件" };
    const result = await organizeTimelineDocument(file, {
      startDate: project.startDate, endDate: projectEndDate(project.startDate, project.contractMonths),
    });
    return { error: null, result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "文件识别失败，请重试" };
  } finally {
    if (file) await discardImportedFile(file).catch(() => {});
  }
}

function readTimelineRows(formData: FormData, startDate: string) {
  if (formData.get("confirmed") !== "yes") return { ok: false as const, error: "请先核对节点并勾选确认" };
  return validateTimelineRows(formData.getAll("dueDate").map(str), formData.getAll("title").map(str), startDate);
}

/**
 * 首次录入 timeline：直接生效，进入日历和当日 checklist。
 * 已经有 timeline 时，项目经理只能提交修改申请（submitTimelineRevisionAction）。
 */
export async function saveTimelineAction(_prev: TimelineFormState, formData: FormData): Promise<TimelineFormState> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { project, error } = await loadProject(session, projectId);
  if (!project) return { error: error ?? "无权操作" };
  const existing = await prisma.timelineItem.count({ where: { projectId } });
  if (existing > 0) return { error: "已经有 timeline 了，修改请提交修改申请，由管理员审批" };

  const input = readTimelineRows(formData, project.startDate);
  if (!input.ok) return { error: input.error };
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.timelineItem.count({ where: { projectId } })) throw new Error("timeline 已有更新，请刷新后提交修改申请");
      await tx.timelineItem.createMany({
        data: input.items.map((it, i) => ({ projectId, title: it.title, dueDate: it.dueDate, sortOrder: i, createdById: session.uid })),
      });
      await markTimelineSubmitted(projectId, session.uid,
        "项目经理确认 timeline：\n" + input.items.map((i) => i.dueDate + " " + i.title).join("\n"), null, tx);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "保存失败，请重试" };
  }
  back(projectId, { saved: String(input.items.length) });
}

/**
 * 修改 timeline：在当前未完成的节点上改日期、增删行，整份提交为待审批的修改申请。
 * 管理员通过前，日历和扣分都按原 timeline；同一项目只保留一份待审批申请（新的替换旧的）。
 */
export async function submitTimelineRevisionAction(_prev: TimelineFormState, formData: FormData): Promise<TimelineFormState> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { project, error } = await loadProject(session, projectId);
  if (!project) return { error: error ?? "无权操作" };
  const reason = str(formData.get("reason")).slice(0, 500);
  if (!reason) return { error: "请写一句修改原因，方便管理员审批" };

  const input = readTimelineRows(formData, project.startDate);
  if (!input.ok) return { error: input.error };
  const current = await prisma.timelineItem.findMany({ where: { projectId } });
  const diff = diffTimeline(current, input.items);
  if (!diff.added.length && !diff.moved.length && !diff.removed.length) {
    return { error: "和当前 timeline 一样，没有需要审批的变化" };
  }
  await prisma.$transaction([
    prisma.timelineRevision.updateMany({ where: { projectId, status: "PENDING" }, data: { status: "WITHDRAWN" } }),
    prisma.timelineRevision.create({
      data: {
        projectId,
        submittedById: session.uid,
        reason,
        sourceText: (str(formData.get("sourceText")) || input.items.map((i) => `${i.dueDate} ${i.title}`).join("\n")).slice(0, TIMELINE_MAX_TEXT),
        sourceFileName: str(formData.get("sourceFileName")).slice(0, 255) || null,
        itemsJson: JSON.stringify(input.items),
      },
    }),
  ]);
  back(projectId, { ok: `已提交修改申请（${diffSummary(diff)}），管理员通过后生效` });
}

/** 撤回待审批的修改申请 */
export async function withdrawTimelineRevisionAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { project, error } = await loadProject(session, projectId);
  if (!project) back(projectId, { error: error ?? "无权操作" });
  await prisma.timelineRevision.updateMany({ where: { projectId, status: "PENDING" }, data: { status: "WITHDRAWN" } });
  back(projectId, { ok: "已撤回修改申请" });
}

export async function completeTimelineItemAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { item, error } = await loadItem(session, projectId, str(formData.get("id")));
  if (!item) back(projectId, { error: error ?? "无权操作" });
  if (item.completedAt) back(projectId, { ok: "已经完成过了" });
  await prisma.timelineItem.update({ where: { id: item.id }, data: { completedAt: new Date(), completedById: session.uid } });
  back(projectId, { ok: `已完成：${item.title}` });
}

/** 撤销勾选：PM 仅限当天，ADMIN 不限 */
export async function undoTimelineItemAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { item, error } = await loadItem(session, projectId, str(formData.get("id")));
  if (!item) back(projectId, { error: error ?? "无权操作" });
  if (!canUndoTimelineItem(session, item, toBjYmd(new Date()))) back(projectId, { error: "只能撤销当天勾选的条目；更早的请联系管理员" });
  await prisma.timelineItem.update({ where: { id: item.id }, data: { completedAt: null, completedById: null } });
  back(projectId, { ok: `已撤销：${item.title}` });
}

const editSchema = z.object({
  dueDate: z.string().refine(isYmd, "日期格式必须是 YYYY-MM-DD"),
  title: z.string().min(1, "事项不能为空").max(200, "事项最多 200 字"),
});

/** 改日期 / 标题：PM 仅限截止未到且未完成的条目，ADMIN 不限 */
export async function updateTimelineItemAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { item, error } = await loadItem(session, projectId, str(formData.get("id")));
  if (!item) back(projectId, { error: error ?? "无权操作" });
  if (!canEditTimelineItem(session, item, toBjYmd(new Date()))) back(projectId, { error: "已过截止或已完成的条目只有管理员能改" });
  const parsed = editSchema.safeParse({ dueDate: str(formData.get("dueDate")), title: str(formData.get("title")) });
  if (!parsed.success) back(projectId, { error: parsed.error.issues[0]?.message ?? "表单校验失败" });
  await prisma.timelineItem.update({ where: { id: item.id }, data: parsed.data });
  back(projectId, { ok: `已修改：${parsed.data.dueDate} ${parsed.data.title}` });
}

/** 删除：PM 仅限截止未到且未完成的条目，ADMIN 不限 */
export async function deleteTimelineItemAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const projectId = str(formData.get("projectId"));
  const { item, error } = await loadItem(session, projectId, str(formData.get("id")));
  if (!item) back(projectId, { error: error ?? "无权操作" });
  if (!canEditTimelineItem(session, item, toBjYmd(new Date()))) back(projectId, { error: "已过截止或已完成的条目只有管理员能删" });
  await prisma.timelineItem.delete({ where: { id: item.id } });
  back(projectId, { ok: `已删除：${item.title}` });
}
