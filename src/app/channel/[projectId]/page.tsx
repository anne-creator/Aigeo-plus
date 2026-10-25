import Link from "next/link";
import { notFound } from "next/navigation";
import { CLIENT_VIEW_CSS, ClientProjectView } from "@/components/client-view/project-view";
import { requireSession } from "@/lib/auth";
import { channelCanSee, getClientView } from "@/lib/client-view";
import { prisma } from "@/lib/db";

/** 渠道方查看单个客户：只能看来源为本渠道的项目（管理员可看全部） */
export default async function ChannelProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await requireSession(["CHANNEL"]);
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, source: true } });
  if (!project) notFound();
  const isAdmin = session.role === "ADMIN";
  if (!isAdmin && !channelCanSee(session.channel, project)) notFound();
  const view = await getClientView(project.id);
  if (!view) notFound();
  const back = isAdmin && project.source !== "DIRECT" ? `/channel?ch=${project.source}` : "/channel";

  return (
    <div className="space-y-4">
      <Link href={back as never} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <span aria-hidden>←</span> 返回我的客户
      </Link>
      <style>{CLIENT_VIEW_CSS}</style>
      <ClientProjectView view={view} fileHref={(id) => `/api/files/${id}`} />
    </div>
  );
}
