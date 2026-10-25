import Link from "next/link";
import { Badge, Card, Empty, LinkButton, PageHeader, Table, Td, Th, pct } from "@/components/ui";
import { CLIENT_SOURCES, sourceLabel } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { getQuarterSummary } from "@/lib/deliverables";
import { PLAN_TIERS, PROJECT_STATUSES, labelOf } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { projectProgress } from "@/lib/timeline";
import { ProgressCell, Tabs } from "../_components";
import { currentQuarter, one, projectStatusTone } from "../_lib";

export default async function AdminProjects({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const statusFilter = one(sp.status) ?? "";
  const valid = PROJECT_STATUSES.some((s) => s.value === statusFilter) ? statusFilter : "";
  const sourceFilter = one(sp.source) ?? "";
  const validSource = CLIENT_SOURCES.some((s) => s.value === sourceFilter) ? sourceFilter : "";
  const hrefFor = (status: string, source: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (source) qs.set("source", source);
    const q = qs.toString();
    return q ? `/admin/projects?${q}` : "/admin/projects";
  };
  const now = new Date();

  const [config, projects, counts, sourceCounts] = await Promise.all([
    getRulesConfig(),
    prisma.project.findMany({
      where: { ...(valid ? { status: valid } : {}), ...(validSource ? { source: validSource } : {}) },
      include: {
        kpis: true,
        pm: { select: { name: true } },
        deliverables: { select: { dueAt: true, firstSubmittedAt: true } },
        timelineItems: { select: { dueDate: true, completedAt: true } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.project.groupBy({ by: ["status"], where: validSource ? { source: validSource } : undefined, _count: { _all: true } }),
    prisma.project.groupBy({ by: ["source"], where: valid ? { status: valid } : undefined, _count: { _all: true } }),
  ]);
  const sourceCountOf = (s: string) => sourceCounts.find((c) => c.source === s)?._count._all ?? 0;
  const sourceTotal = sourceCounts.reduce((a, c) => a + c._count._all, 0);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((a, c) => a + c._count._all, 0);

  const rows = await Promise.all(
    projects.map(async (p) => {
      const q = currentQuarter(p, now);
      const summary = await getQuarterSummary(p, q, { config, asOf: now });
      return { p, q, summary, progress: projectProgress(p, p.deliverables, p.timelineItems, now) };
    }),
  );

  return (
    <>
      <PageHeader
        title="全部项目"
        description="所有项目经理的客户档案；得分为当前季度截至目前的交付得分，进度 = 已完成的系统节点 + timeline 条目"
        actions={<LinkButton href="/admin/projects/new">新建项目</LinkButton>}
      />
      <Tabs
        items={[
          { href: hrefFor("", validSource), label: "全部", active: valid === "", count: total },
          ...PROJECT_STATUSES.map((s) => ({ href: hrefFor(s.value, validSource), label: s.label, active: valid === s.value, count: countOf(s.value) })),
        ]}
      />
      <Tabs
        items={[
          { href: hrefFor(valid, ""), label: "全部来源", active: validSource === "", count: sourceTotal },
          ...CLIENT_SOURCES.map((s) => ({ href: hrefFor(valid, s.value), label: s.label, active: validSource === s.value, count: sourceCountOf(s.value) })),
        ]}
      />
      <Card>
        {rows.length === 0 ? (
          <Empty>没有符合条件的项目</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>客户</Th>
                <Th>项目经理</Th>
                <Th>来源</Th>
                <Th>档位</Th>
                <Th>开始日期</Th>
                <Th>合同</Th>
                <Th>状态</Th>
                <Th>当前季度得分</Th>
                <Th>进度</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, q, summary, progress }) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">
                      {p.clientName}
                    </Link>
                    <div className="text-xs text-muted">{p.websiteUrl}</div>
                  </Td>
                  <Td>{p.pm.name}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={p.source === "DIRECT" ? "zinc" : "blue"}>{sourceLabel(p.source)}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{labelOf(PLAN_TIERS, p.planTier)}</Td>
                  <Td className="whitespace-nowrap">{p.startDate}</Td>
                  <Td className="whitespace-nowrap">
                    {p.contractMonths} 个月
                    {p.terminationDate ? <div className="text-xs text-muted">止于 {p.terminationDate}</div> : null}
                  </Td>
                  <Td>
                    <Badge tone={projectStatusTone(p.status)}>{labelOf(PROJECT_STATUSES, p.status)}</Badge>
                  </Td>
                  <Td>
                    <span className={summary.score.scorePct < 80 ? "font-medium text-amber-700" : "font-medium"}>{pct(summary.score.scorePct)}</span>
                    <div className="text-xs text-muted">
                      第 {q} 季度 · 计入 {summary.score.countedItems}/{summary.score.totalItems} 项{summary.finalized ? " · 已结算" : ""}
                    </div>
                  </Td>
                  <Td>
                    <ProgressCell p={progress} />
                  </Td>
                  <Td>
                    <Link href={`/admin/projects/${p.id}`} className="text-xs underline">
                      详情
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
