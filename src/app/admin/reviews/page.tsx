import Link from "next/link";
import { Alert, Card, Empty, PageHeader, ReviewBadge, StatusBadge, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { deliverableStatus } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { formatBj, lateDays } from "@/lib/time";
import { ReviewForms, ReviewSourceTag, SubmissionPreview, Tabs } from "../_components";
import { TimelineRevisionQueue } from "./timeline-revisions";
import { REVIEW_STATUSES, kindLabel, latestSubmissionsFor, one, withQuery } from "../_lib";

export default async function AdminReviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const saved = one(sp.saved);
  const raw = one(sp.status) ?? "PENDING";
  const status = REVIEW_STATUSES.some((s) => s.value === raw) ? raw : "PENDING";
  const now = new Date();
  const back = withQuery("/admin/reviews", { status });

  const [config, counts, items, finalizedRows] = await Promise.all([
    getRulesConfig(),
    prisma.deliverable.groupBy({ by: ["reviewStatus"], where: { reviewStatus: { in: REVIEW_STATUSES.map((s) => s.value) } }, _count: { _all: true } }),
    prisma.deliverable.findMany({
      where: { reviewStatus: status },
      include: { project: { select: { id: true, clientName: true, pm: { select: { name: true } } } }, reviewedBy: { select: { name: true } } },
      orderBy: [{ firstSubmittedAt: "desc" }],
      take: 200,
    }),
    prisma.quarterAssessment.findMany({ where: { finalizedAt: { not: null } }, select: { projectId: true, quarter: true } }),
  ]);
  const latest = await latestSubmissionsFor(items.map((d) => d.id));
  // 已结算固化的季度不再提供审核操作
  const finalized = new Set(finalizedRows.map((r) => `${r.projectId}:${r.quarter}`));
  const countOf = (s: string) => counts.find((c) => c.reviewStatus === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="材料审核" description="核对提交材料与季初约定的交付内容是否一致；不通过会额外扣该项权重的一定比例，项目经理可重新提交" />
      {error ? (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <Alert tone="green">审核结果已保存。</Alert>
        </div>
      ) : null}
      <div className="mb-6">
        <TimelineRevisionQueue back={back} />
      </div>
      <Tabs items={REVIEW_STATUSES.map((s) => ({ href: withQuery("/admin/reviews", { status: s.value }), label: s.label, active: status === s.value, count: countOf(s.value) }))} />
      <Card>
        {items.length === 0 ? (
          <Empty>没有「{REVIEW_STATUSES.find((s) => s.value === status)?.label}」的材料</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>项目 / 项目经理</Th>
                <Th>交付物</Th>
                <Th>形式</Th>
                <Th>截止（北京）</Th>
                <Th>首次提交</Th>
                <Th>延期</Th>
                <Th>最新提交</Th>
                <Th>审核</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const late = d.firstSubmittedAt ? lateDays(d.dueAt, d.firstSubmittedAt) : 0;
                return (
                  <tr key={d.id}>
                    <Td>
                      <Link href={`/admin/projects/${d.project.id}`} className="font-medium hover:underline">
                        {d.project.clientName}
                      </Link>
                      <div className="text-xs text-muted">{d.project.pm.name}</div>
                    </Td>
                    <Td>
                      <Link href={`/admin/projects/${d.project.id}#d-${d.id}`} className="hover:underline">
                        {d.title}
                      </Link>
                      <div className="text-xs text-muted">
                        第 {d.quarter} 季度 · {d.periodLabel}
                        {d.kind === "TIMELINE" ? (
                          <>
                            {" · "}
                            <Link href={`/admin/projects/${d.project.id}#project-timeline`} className="underline">
                              查看条目
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-xs">{kindLabel(d.kind)}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatBj(d.dueAt)}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatBj(d.firstSubmittedAt)}
                      <div>
                        <StatusBadge status={deliverableStatus(d, now)} />
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{late > 0 ? <span className="text-amber-700">{late} 天</span> : <span className="text-muted">0</span>}</Td>
                    <Td>
                      <SubmissionPreview sub={latest.get(d.id)} />
                    </Td>
                    <Td>
                      <ReviewBadge status={d.reviewStatus} />
                      {d.reviewSource ? <ReviewSourceTag source={d.reviewSource} /> : null}
                      {d.reviewStatus !== "PENDING" ? (
                        <div className="mt-1 max-w-48 text-xs text-muted">
                          {d.reviewedBy?.name ?? ""} · {formatBj(d.reviewedAt)}
                          {d.reviewNote ? <div className="text-red-700">{d.reviewNote}</div> : null}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <ReviewForms
                        deliverableId={d.id}
                        reviewStatus={d.reviewStatus}
                        hasSubmission={latest.has(d.id)}
                        back={back}
                        defaultPct={config.reviewRejectDeductionPct}
                        locked={finalized.has(`${d.projectId}:${d.quarter}`)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
