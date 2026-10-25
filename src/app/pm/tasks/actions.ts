"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessProject, requireSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, saveUpload, fileFromForm } from "@/lib/files";
import { confirmBatch, DUTY_ROLE_VALUES, dutyRoleLabel, extractTextFromFile, organizeTasks, TASK_DOC_EXTENSIONS } from "@/lib/tasks";
import { ASSIGNABLE_STATUSES, batchHref, itemsFromForm, MAX_ITEMS, TASKS_HREF } from "./_lib";

function go(path: string, q: Record<string, string> = {}): never {
  const qs = new URLSearchParams(q).toString();
  revalidatePath("/", "layout");
  redirect(`${path}${qs ? `?${qs}` : ""}`);
}

const MAX_TEXT = 60_000;

const createSchema = z.object({
  projectId: z.string().min(1, "请选择客户"),
  dutyRole: z.enum(DUTY_ROLE_VALUES, { message: "请选择负责人类型" }),
  text: z.string().max(MAX_TEXT, "文字太长了，请分几次分配"),
});

/** 第 1 步：选客户 + 负责人，提交文字或文档 → 整理成草稿清单 */
export async function createBatchAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const raw = {
    projectId: String(formData.get("projectId") ?? ""),
    dutyRole: String(formData.get("dutyRole") ?? ""),
    text: String(formData.get("text") ?? "").trim(),
  };
  // 出错时保留已选的客户和类型
  const keep: Record<string, string> = {};
  if (raw.projectId) keep.project = raw.projectId;
  if (raw.dutyRole) keep.role = raw.dutyRole;
  function fail(msg: string): never {
    go(TASKS_HREF, { ...keep, error: msg });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "表单校验失败");
  const { projectId, dutyRole, text } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, pmId: true, status: true } });
  if (!project || !canAccessProject(session, project)) fail("客户不存在或无权操作");
  if (!ASSIGNABLE_STATUSES.includes(project.status)) fail("该客户已结束，不能再分配任务");

  const picked = String(formData.get(`assignee_${dutyRole}`) ?? "");
  const assignee = await prisma.user.findFirst({
    where: { role: "INTERN", active: true, dutyRole, ...(picked ? { id: picked } : {}) },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (!assignee) fail(`暂无${dutyRoleLabel(dutyRole)}`);

  let file: File | null = null;
  try { file = await fileFromForm(formData, session.uid, "task-source", projectId); }
  catch (e) { fail(e instanceof Error ? e.message : "上传失败"); }
  if (!file && !text) fail("请填写任务内容，或上传文档");

  let fileText = "";
  if (file) {
    const lower = file.name.toLowerCase();
    if (!TASK_DOC_EXTENSIONS.some((ext) => lower.endsWith(ext))) fail(`只支持 ${TASK_DOC_EXTENSIONS.join(" / ")} 文档`);
    if (file.size > MAX_UPLOAD_BYTES) fail("文件超过 50MB");
    try {
      fileText = (await extractTextFromFile(file)).trim();
    } catch {
      fileText = "";
    }
    if (!fileText) fail("没能从文档里读出文字，请直接粘贴文字");
  }

  const sourceText = [text, fileText].filter(Boolean).join("\n\n").slice(0, MAX_TEXT);
  const { items, method } = await organizeTasks(sourceText, { roleLabel: dutyRoleLabel(dutyRole) });

  let stored: { relPath: string; fileName: string; size: number } | null = null;
  if (file) {
    try {
      stored = await saveUpload(file, "task-sources");
    } catch (e) {
      fail(e instanceof Error ? e.message : "文件保存失败");
    }
  }

  const batch = await prisma.taskBatch.create({
    data: {
      projectId,
      createdById: session.uid,
      assigneeId: assignee.id,
      dutyRole,
      sourceText,
      sourceFileName: stored?.fileName ?? null,
      sourceFilePath: stored?.relPath ?? null,
      sourceFileSize: stored?.size ?? null,
      sourceMimeType: file ? file.type || null : null,
      itemsJson: JSON.stringify(items.slice(0, MAX_ITEMS)),
      parseMethod: method,
      status: "DRAFT",
    },
    select: { id: true },
  });
  go(batchHref(batch.id));
}

/** 批次必须是草稿、且项目属于当前 PM（ADMIN 不限） */
async function loadDraft(session: Session, batchId: string) {
  const batch = await prisma.taskBatch.findUnique({
    where: { id: batchId },
    include: { project: { select: { pmId: true } }, assignee: { select: { active: true } } },
  });
  if (!batch || !canAccessProject(session, batch.project)) return { batch: null, error: "清单不存在或无权操作" };
  if (batch.status !== "DRAFT") return { batch: null, error: "这份清单已经处理过了" };
  return { batch, error: null };
}

const idSchema = z.object({ batchId: z.string().min(1) });

function readItems(formData: FormData, batchId: string) {
  const items = itemsFromForm(formData);
  if (items.length > MAX_ITEMS) go(batchHref(batchId), { error: `一次最多 ${MAX_ITEMS} 条` });
  return items;
}

/** 只保存修改，不下发 */
export async function saveDraftAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const parsed = idSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) go(TASKS_HREF, { error: "清单不存在" });
  const { batchId } = parsed.data;
  const { batch, error } = await loadDraft(session, batchId);
  if (!batch) go(batchHref(batchId), { error: error ?? "无权操作" });
  const items = readItems(formData, batchId);
  await prisma.taskBatch.update({ where: { id: batchId }, data: { itemsJson: JSON.stringify(items) } });
  go(batchHref(batchId), { saved: "1" });
}

/** 确认下发：先保存修改（出错时不丢），再写入负责人的日历和待办 */
export async function confirmBatchAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const parsed = idSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) go(TASKS_HREF, { error: "清单不存在" });
  const { batchId } = parsed.data;
  const { batch, error } = await loadDraft(session, batchId);
  if (!batch) go(batchHref(batchId), { error: error ?? "无权操作" });
  if (!batch.assignee.active) go(batchHref(batchId), { error: "该负责人账号已停用，请放弃这份清单后重新分配" });

  const items = readItems(formData, batchId);
  await prisma.taskBatch.update({ where: { id: batchId }, data: { itemsJson: JSON.stringify(items) } });

  let count = 0;
  let message = "";
  try {
    count = await confirmBatch(batchId, items, session.uid);
  } catch (e) {
    message = e instanceof Error ? e.message : "下发失败";
  }
  if (message) go(batchHref(batchId), { error: message });
  go(batchHref(batchId), { confirmed: String(count) });
}

/** 放弃这份草稿 */
export async function discardBatchAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const parsed = idSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) go(TASKS_HREF, { error: "清单不存在" });
  const { batchId } = parsed.data;
  const { batch, error } = await loadDraft(session, batchId);
  if (!batch) go(batchHref(batchId), { error: error ?? "无权操作" });
  await prisma.taskBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
  go(TASKS_HREF, { discarded: "1" });
}
