import Link from "next/link";
import { Button, Card, CardTitle, Input } from "@/components/ui";
import { TimelineDiffView } from "@/components/timeline-diff";
import { prisma } from "@/lib/db";
import { diffTimeline, parseProposedJson } from "@/lib/timeline";
import { formatBj } from "@/lib/time";
import { decideTimelineRevision } from "./timeline-actions";

/** 待审批的 timeline 修改申请（项目经理重新提交整份 timeline） */
export async function TimelineRevisionQueue({ back, projectId }: { back: string; projectId?: string }) {
  const pending = await prisma.timelineRevision.findMany({
    where: { status: "PENDING", ...(projectId ? { projectId } : {}) },
    include: { project: { select: { id: true, clientName: true } }, submittedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!pending.length) return null;
  const current = await prisma.timelineItem.findMany({ where: { projectId: { in: pending.map((p) => p.projectId) } } });
  return (
    <div className="space-y-3">
      {pending.map((r) => {
        const diff = diffTimeline(
          current.filter((c) => c.projectId === r.projectId),
          parseProposedJson(r.itemsJson),
        );
        return (
          <Card key={r.id} className="border-amber-300">
            <CardTitle right={<span className="text-xs text-muted">{formatBj(r.createdAt)}</span>}>
              timeline 修改申请 ·{" "}
              <Link href={`/admin/projects/${r.project.id}#project-timeline`} className="hover:underline">
                {r.project.clientName}
              </Link>
            </CardTitle>
            <p className="mb-3 text-sm">
              <span className="text-muted">{r.submittedBy.name}：</span>
              {r.reason ?? "（未写原因）"}
              {r.sourceFileName ? <span className="ml-2 text-xs text-muted">文件 {r.sourceFileName}</span> : null}
            </p>
            <TimelineDiffView diff={diff} />
            <form action={decideTimelineRevision} className="mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="back" value={back} />
              <Input name="note" maxLength={500} placeholder="审批意见（驳回时必填）" className="sm:flex-1" aria-label="审批意见" />
              <div className="flex gap-2">
                <Button type="submit" name="decision" value="APPROVE">
                  通过并生效
                </Button>
                <Button type="submit" name="decision" value="REJECT" variant="secondary">
                  驳回
                </Button>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
