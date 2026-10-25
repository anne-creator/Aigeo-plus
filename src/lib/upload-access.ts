import { canAccessProject, type Session } from "./auth";
import { prisma } from "./db";
import { TIMELINE_EXTENSIONS, TIMELINE_FILE_LIMIT } from "./timeline-import";
import { TASK_DOC_EXTENSIONS } from "./tasks";
import type { UploadRequest } from "./upload-ticket";

export async function authorizeUpload(session: Session, input: UploadRequest) {
  const { purpose, targetId, fileName, size } = input;
  if (purpose === "task-delivery") {
    const task = await prisma.internTask.findUnique({ where: { id: targetId }, select: { assigneeId: true } });
    if (!task || (session.role !== "ADMIN" && (session.role !== "INTERN" || task.assigneeId !== session.uid))) throw new Error("无权上传到该任务");
    return;
  }
  if (session.role !== "ADMIN" && session.role !== "PM") throw new Error("无权上传");
  if (purpose === "deliverable") {
    const item = await prisma.deliverable.findUnique({ where: { id: targetId }, include: { project: true } });
    if (!item || item.kind !== "FILE" || !canAccessProject(session, item.project)) throw new Error("无权上传到该节点");
  } else {
    const project = await prisma.project.findUnique({ where: { id: targetId }, select: { pmId: true } });
    if (!project || !canAccessProject(session, project)) throw new Error("无权上传到该项目");
    const extensions = purpose === "timeline" ? TIMELINE_EXTENSIONS.split(",") : TASK_DOC_EXTENSIONS;
    if (!extensions.some((ext) => fileName.toLowerCase().endsWith(ext.trim()))) throw new Error("不支持的文件格式");
    if (purpose === "timeline" && size > TIMELINE_FILE_LIMIT) throw new Error("timeline 文件不能超过 15 MB");
  }
}
