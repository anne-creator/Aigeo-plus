"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { canAccessProject, requireSession } from "@/lib/auth";
import { ensureShareToken, revokeShareToken, rotateShareToken } from "@/lib/client-view";
import { prisma } from "@/lib/db";

/** 校验当前用户是该项目的 PM（或管理员），返回项目 id */
async function authorizedProjectId(formData: FormData): Promise<string> {
  const session = await requireSession(["PM"]);
  const id = formData.get("projectId");
  if (typeof id !== "string" || !id) notFound();
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, pmId: true } });
  if (!project || !canAccessProject(session, project)) notFound();
  return project.id;
}

function back(projectId: string): never {
  revalidatePath(`/pm/projects/${projectId}`);
  redirect(`/pm/projects/${projectId}#share`);
}

/** 生成分享链接（已有则沿用） */
export async function createShareLinkAction(formData: FormData): Promise<void> {
  const id = await authorizedProjectId(formData);
  await ensureShareToken(id);
  back(id);
}

/** 重新生成链接：旧链接立即失效 */
export async function rotateShareLinkAction(formData: FormData): Promise<void> {
  const id = await authorizedProjectId(formData);
  await rotateShareToken(id);
  back(id);
}

/** 关闭分享 */
export async function revokeShareLinkAction(formData: FormData): Promise<void> {
  const id = await authorizedProjectId(formData);
  await revokeShareToken(id);
  back(id);
}
