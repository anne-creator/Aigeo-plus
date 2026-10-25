import { Card, Empty, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBjDate } from "@/lib/time";

function formatSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 客户知识库：自己有任务的每个客户，显示项目经理上传的最新一版知识库文件（客户已认可的版本） */
export default async function InternKnowledgePage() {
  const session = await requireSession(["INTERN"]);

  const projects = await prisma.project.findMany({
    where: { internTasks: { some: { assigneeId: session.uid } } },
    select: {
      id: true,
      clientName: true,
      deliverables: {
        where: { code: "KNOWLEDGE_BASE" },
        select: {
          submissions: {
            where: { filePath: { not: null } },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { id: true, fileName: true, fileSize: true, submittedAt: true, note: true, version: true },
          },
        },
      },
    },
    orderBy: { clientName: "asc" },
  });

  const rows = projects.map((p) => {
    const latest = p.deliverables
      .flatMap((d) => d.submissions)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
    return { id: p.id, clientName: p.clientName, latest: latest ?? null };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="客户知识库" description="项目经理上传的、客户已认可的知识库。写内容前先下载看一遍。" />

      {rows.length === 0 ? (
        <Empty>你还没有任何客户的任务，分到任务后这里会出现该客户的知识库。</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{r.clientName}</h2>
                  {r.latest ? (
                    <div className="mt-1 text-sm text-muted">
                      <span className="break-all text-foreground/80">{r.latest.fileName ?? "知识库文件"}</span>
                      {r.latest.fileSize ? <span className="ml-2">{formatSize(r.latest.fileSize)}</span> : null}
                      <span className="ml-2">· 上传于 {formatBjDate(r.latest.submittedAt)}</span>
                      {r.latest.note ? <p className="mt-1 whitespace-pre-wrap">{r.latest.note}</p> : null}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-muted">项目经理尚未上传</div>
                  )}
                </div>
                {r.latest ? (
                  <a
                    href={`/api/files/${r.latest.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-base font-medium text-white hover:bg-blue-700 sm:text-sm"
                  >
                    下载
                  </a>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
