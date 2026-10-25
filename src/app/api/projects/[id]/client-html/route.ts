import { createElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_VIEW_CSS, ClientProjectView } from "@/components/client-view/project-view";
import { escapeHtml, renderStaticMarkup } from "@/components/client-view/static-markup";
import { canAccessProject, getSession } from "@/lib/auth";
import { getClientView } from "@/lib/client-view";
import { prisma } from "@/lib/db";

/** 导出客户进度的单文件 HTML（发给客户直接打开）。需项目的 PM 或管理员。 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/projects/[id]/client-html">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, pmId: true, shareToken: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!(session.role === "PM" || session.role === "ADMIN") || !canAccessProject(session, project)) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const view = await getClientView(project.id);
  if (!view) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  // 快照里的下载按钮指向分享页的文件地址（绝对 URL）；未开启分享则不放下载按钮
  const origin = requestOrigin(req);
  const token = project.shareToken;
  const fileHref = (submissionId: string) => (token ? `${origin}/share/${token}/file/${submissionId}` : null);
  // 路由处理器里不能 import react-dom/server（见 static-markup.ts），用自带的静态序列化
  const body = renderStaticMarkup(createElement(ClientProjectView, { view, fileHref }));
  const title = `${view.clientName} · 项目进度`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;padding:0;background:#f5f7fb}</style>
<style>${CLIENT_VIEW_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
  const ymd = view.today.replaceAll("-", "");
  const fileName = `${view.clientName}-项目进度-${ymd}.html`.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}
