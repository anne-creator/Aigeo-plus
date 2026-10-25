import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storedFileStream } from "@/lib/files";

/**
 * 任务相关文件下载：
 * - /api/task-files/source/<batchId>   项目经理分配任务时上传的原始文档
 * - /api/task-files/delivery/<submissionId>  负责人上传的交付物文件
 * 可下载：管理员、该项目的项目经理、该任务的负责人。
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/task-files/[kind]/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { kind, id } = await ctx.params;

  let file: { path: string | null; name: string | null; mime: string | null; pmId: string; assigneeId: string } | null = null;
  if (kind === "source") {
    const b = await prisma.taskBatch.findUnique({ where: { id }, include: { project: { select: { pmId: true } } } });
    if (b) file = { path: b.sourceFilePath, name: b.sourceFileName, mime: b.sourceMimeType, pmId: b.project.pmId, assigneeId: b.assigneeId };
  } else if (kind === "delivery") {
    const s = await prisma.taskSubmission.findUnique({
      where: { id },
      include: { task: { select: { assigneeId: true, project: { select: { pmId: true } }, createdById: true } } },
    });
    if (s) file = { path: s.filePath, name: s.fileName, mime: s.mimeType, pmId: s.task.project?.pmId ?? s.task.createdById, assigneeId: s.task.assigneeId };
  }
  if (!file || !file.path) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  const allowed = session.role === "ADMIN" || session.uid === file.pmId || session.uid === file.assigneeId;
  if (!allowed) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  let stream: ReadableStream;
  try {
    stream = await storedFileStream(file.path);
  } catch {
    return NextResponse.json({ error: "文件已丢失" }, { status: 404 });
  }
  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name || "file")}`,
    },
  });
}
