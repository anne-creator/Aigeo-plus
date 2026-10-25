/**
 * PM 项目页上的「分享给客户」卡片（服务端组件，无客户端 JS）。
 * 二次确认用 <details> 展开，避免误点。
 */
import { headers } from "next/headers";
import { Button, Card, CardTitle, Input } from "@/components/ui";
import { createShareLinkAction, revokeShareLinkAction, rotateShareLinkAction } from "@/app/pm/projects/[id]/share-actions";

async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

const linkCls = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-zinc-50";
const summaryCls = "cursor-pointer list-none rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-zinc-100 hover:text-foreground [&::-webkit-details-marker]:hidden";

export async function ShareCard({ projectId, shareToken }: { projectId: string; shareToken: string | null }) {
  const hint = "客户无需登录即可查看进度和下载已交付文件；页面不显示任何内部考核信息。";
  if (!shareToken) {
    return (
      <Card id="share">
        <CardTitle>分享给客户</CardTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{hint}</p>
          <form action={createShareLinkAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit">生成分享链接</Button>
          </form>
        </div>
      </Card>
    );
  }
  const url = `${await currentOrigin()}/share/${shareToken}`;
  return (
    <Card id="share">
      <CardTitle>分享给客户</CardTitle>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} aria-label="客户分享链接" className="font-mono text-xs sm:flex-1" />
        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noreferrer" className={linkCls}>
            打开预览
          </a>
          <a href={`/api/projects/${projectId}/client-html`} className={linkCls}>
            下载 HTML
          </a>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{hint}</p>
      <div className="-ml-3 mt-1">
        <div className="flex flex-wrap items-start gap-1">
          <details className="group">
            <summary className={summaryCls}>重新生成链接</summary>
            <form action={rotateShareLinkAction} className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-zinc-50 px-3 py-2">
              <input type="hidden" name="projectId" value={projectId} />
              <span className="text-xs text-muted">旧链接将立即失效，确定？</span>
              <Button type="submit" variant="secondary" className="whitespace-nowrap px-2.5 py-1 text-xs">
                确定重新生成
              </Button>
            </form>
          </details>
          <details className="group">
            <summary className={summaryCls}>关闭分享</summary>
            <form action={revokeShareLinkAction} className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-zinc-50 px-3 py-2">
              <input type="hidden" name="projectId" value={projectId} />
              <span className="text-xs text-muted">关闭后客户将无法打开链接，确定？</span>
              <Button type="submit" variant="danger" className="whitespace-nowrap px-2.5 py-1 text-xs">
                确定关闭
              </Button>
            </form>
          </details>
        </div>
      </div>
    </Card>
  );
}
