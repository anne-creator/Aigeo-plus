import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CLIENT_VIEW_CSS, ClientProjectView } from "@/components/client-view/project-view";
import { getClientView, projectIdByShareToken } from "@/lib/client-view";

/** 客户分享页：公开、无需登录。只展示进度与交付物，不含任何内部考核信息。 */
export const dynamic = "force-dynamic";

async function loadView(token: string) {
  const projectId = await projectIdByShareToken(token);
  if (!projectId) return null;
  return getClientView(projectId);
}

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const { token } = await params;
  const view = await loadView(token);
  const robots = { index: false, follow: false };
  if (!view) return { title: "链接已失效", description: "该项目进度链接不存在或已关闭。", robots };
  return {
    title: `${view.clientName} · 项目进度`,
    description: `${view.clientName} GEO 项目进度与交付物`,
    robots,
    referrer: "no-referrer",
  };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const view = await loadView(token);
  if (!view) notFound();
  return (
    <>
      <style>{CLIENT_VIEW_CSS}</style>
      <ClientProjectView view={view} fileHref={(id) => `/share/${token}/file/${id}`} />
    </>
  );
}
