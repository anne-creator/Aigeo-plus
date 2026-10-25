import { NextResponse, type NextRequest } from "next/server";
import { canAccessProject, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storedFileStream } from "@/lib/files";
import { assigneeHasProject } from "@/lib/tasks";
import { channelCanSee, submissionInProject } from "@/lib/client-view";

/** 下载提交的文件：管理员或项目的 PM 可下载；负责人只能下载自己有任务的客户的知识库 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[submissionId]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { submissionId } = await ctx.params;
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { deliverable: { include: { project: true } } },
  });
  if (!sub || !sub.filePath) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  const allowed =
    canAccessProject(session, sub.deliverable.project) ||
    (session.role === "INTERN" &&
      sub.deliverable.code === "KNOWLEDGE_BASE" &&
      (await assigneeHasProject(session.uid, sub.deliverable.projectId))) ||
    (session.role === "CHANNEL" &&
      channelCanSee(session.channel, sub.deliverable.project) &&
      (await submissionInProject(sub.id, sub.deliverable.projectId)));
  if (!allowed) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  let stream: ReadableStream;
  try {
    stream = await storedFileStream(sub.filePath);
  } catch {
    return NextResponse.json({ error: "文件已丢失" }, { status: 404 });
  }
  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": sub.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sub.fileName || "file")}`,
    },
  });
}
