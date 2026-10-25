import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { storedFileStream } from "@/lib/files";
import { projectIdByShareToken, submissionInProject } from "@/lib/client-view";

/** 客户分享页的文件下载：令牌有效且文件属于该项目的客户可见节点才放行（无需登录） */
export async function GET(_req: NextRequest, ctx: RouteContext<"/share/[token]/file/[submissionId]">) {
  const { token, submissionId } = await ctx.params;
  const notFound = () => NextResponse.json({ error: "文件不存在或链接已失效" }, { status: 404 });
  const projectId = await projectIdByShareToken(token);
  if (!projectId || !(await submissionInProject(submissionId, projectId))) return notFound();
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { filePath: true, fileName: true, mimeType: true } });
  if (!sub?.filePath) return notFound();

  let stream: ReadableStream;
  try {
    stream = await storedFileStream(sub.filePath);
  } catch {
    return notFound();
  }
  return new NextResponse(stream, {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Content-Type": sub.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sub.fileName || "file")}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
