"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, saveUpload, fileFromForm } from "@/lib/files";

/** 回到我的任务并定位到该任务：/intern?saved=1&task=<id>#task-<id> 或 ?error=…&task=<id>#task-<id> */
function back(taskId: string | null, params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  if (taskId) qs.set("task", taskId);
  return `/intern?${qs.toString()}${taskId ? `#task-${taskId}` : ""}`;
}

function rawTaskId(formData: FormData): string | null {
  const v = formData.get("taskId");
  return typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

/** 读取任务并确认是本人的（管理员不限） */
async function loadOwnTask(session: Session, taskId: string) {
  const task = await prisma.internTask.findUnique({ where: { id: taskId } });
  if (!task) redirect(back(null, { error: "任务不存在或已被删除" }));
  if (task.assigneeId !== session.uid && session.role !== "ADMIN") redirect(back(null, { error: "无权操作该任务" }));
  return task;
}

/** 用户常直接粘贴 “www.xxx.com/…”，没写协议的补上 https:// */
function normalizeUrl(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return "";
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) ? s : `https://${s}`;
}

const deliverySchema = z
  .object({
    taskId: z.string({ error: "缺少任务 ID" }).min(1, "缺少任务 ID"),
    url: z.union([
      z.literal(""),
      z
        .string()
        .max(2000, "链接太长了")
        .refine((s) => {
          try {
            const u = new URL(s);
            return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.length > 0;
          } catch {
            return false;
          }
        }, "链接格式不正确，请粘贴以 http:// 或 https:// 开头的完整链接"),
    ]),
    note: z.string().trim().max(300, "备注不能超过 300 字"),
    file: z
      .instanceof(File)
      .refine((f) => f.size <= MAX_UPLOAD_BYTES, `文件不能超过 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`)
      .nullable(),
  })
  .refine((d) => d.url !== "" || d.file !== null, { message: "请粘贴链接或选择一个文件" });

/**
 * 提交交付物：链接和/或文件 + 可选备注 → 新增一条 TaskSubmission；待完成的任务同时标记完成。
 * 表单字段：taskId、url、file、note
 */
export async function submitDeliveryAction(formData: FormData): Promise<void> {
  const session = await requireSession(["INTERN"]);
  const taskIdRaw = rawTaskId(formData);
  if (!taskIdRaw) redirect(back(null, { error: "缺少任务 ID" }));
  const task = await loadOwnTask(session, taskIdRaw);
  let fileRaw: File | null = null;
  try { fileRaw = await fileFromForm(formData, session.uid, "task-delivery", task.id); }
  catch (e) { redirect(back(task.id, { error: e instanceof Error ? e.message : "上传失败" })); }
  const parsed = deliverySchema.safeParse({
    taskId: taskIdRaw ?? "",
    url: normalizeUrl(formData.get("url") ?? ""),
    note: formData.get("note") ?? "",
    // 没选文件时浏览器也会传一个空 File
    file: fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null,
  });
  if (!parsed.success) redirect(back(taskIdRaw, { error: parsed.error.issues[0]?.message ?? "输入不正确" }));

  const { url, note, file } = parsed.data;

  let saved: { relPath: string; fileName: string; size: number; mimeType: string } | null = null;
  if (file) {
    try {
      const r = await saveUpload(file, `task-deliveries/${task.id}`);
      saved = { ...r, mimeType: file.type || "application/octet-stream" };
    } catch (e) {
      redirect(back(task.id, { error: e instanceof Error ? `上传失败：${e.message}` : "上传失败，请重试" }));
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.taskSubmission.create({
      data: {
        taskId: task.id,
        submittedById: session.uid,
        submittedAt: now,
        url: url || null,
        fileName: saved?.fileName ?? null,
        filePath: saved?.relPath ?? null,
        fileSize: saved?.size ?? null,
        mimeType: saved?.mimeType ?? null,
        note: note || null,
      },
    });
    // 只在仍是待完成时改状态，已完成的补交不改完成时间
    await tx.internTask.updateMany({ where: { id: task.id, status: "TODO" }, data: { status: "DONE", completedAt: now } });
  });

  revalidatePath("/", "layout");
  redirect(back(task.id, { saved: "1" }));
}

const reopenSchema = z.object({ taskId: z.string({ error: "缺少任务 ID" }).min(1, "缺少任务 ID") });

/** 标记未完成：已完成的任务回到待完成（交付记录保留）。表单字段：taskId */
export async function reopenTaskAction(formData: FormData): Promise<void> {
  const session = await requireSession(["INTERN"]);
  const taskIdRaw = rawTaskId(formData);
  const parsed = reopenSchema.safeParse({ taskId: taskIdRaw ?? "" });
  if (!parsed.success) redirect(back(null, { error: parsed.error.issues[0]?.message ?? "参数不正确" }));

  const task = await loadOwnTask(session, parsed.data.taskId);
  if (task.status !== "TODO") {
    await prisma.internTask.update({ where: { id: task.id }, data: { status: "TODO", completedAt: null } });
  }
  revalidatePath("/", "layout");
  redirect(back(task.id, { saved: "reopened" }));
}
