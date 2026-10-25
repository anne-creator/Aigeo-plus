import Link from "next/link";
import { Alert, Badge, Empty, LinkButton, PageHeader, pct, Table, Td, Th } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { sourceLabel } from "@/lib/channels";
import { toBjYmd } from "@/lib/time";
import { ProgressBar } from "../_components";
import { loadPmProjects, planTierLabel, projectHref, projectStatusLabel, projectStatusTone, sp } from "../_lib";
import { TimelineDots } from "../_timeline-visual";

export default async function PmProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession(["PM"]);
  const q = await searchParams;
  const error = sp(q.error);
  const { overviews, now } = await loadPmProjects(session);
  const today = toBjYmd(now);

  return (
    <div className="space-y-6">
      <PageHeader title="我的项目" actions={<LinkButton href="/pm/projects/new">新建客户档案</LinkButton>} />
      {error ? <Alert tone="red">{error}</Alert> : null}

      {overviews.length === 0 ? (
        <Empty>还没有项目，点右上角「新建客户档案」开始。</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="min-w-44">客户</Th>
              <Th className="min-w-52">时间线</Th>
              <Th className="min-w-32">完成</Th>
              <Th>逾期</Th>
              <Th>季度得分</Th>
            </tr>
          </thead>
          <tbody>
            {overviews.map((o) => {
              const p = o.project;
              const pr = o.progress;
              return (
                <tr key={p.id}>
                  <Td>
                    <Link href={projectHref(p.id)} className="font-medium hover:underline">
                      {p.clientName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span>
                        {planTierLabel(p.planTier)} · {pr.dayIndex === 0 ? "未开始" : `第 ${pr.dayIndex} 天`} / {pr.totalDays} 天
                      </span>
                      <Badge tone={p.source === "DIRECT" ? "zinc" : "blue"}>{sourceLabel(p.source)}</Badge>
                      {session.role === "ADMIN" ? <span>PM：{p.pm.name}</span> : null}
                      {p.status !== "ACTIVE" ? <Badge tone={projectStatusTone(p.status)}>{projectStatusLabel(p.status)}</Badge> : null}
                    </div>
                  </Td>
                  <Td className="align-middle">
                    <TimelineDots projectId={p.id} items={o.items} today={today} />
                  </Td>
                  <Td className="align-middle">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={pr.donePct} />
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{pr.donePct}%</span>
                    </div>
                  </Td>
                  <Td className={`align-middle tabular-nums ${pr.overdueItems > 0 ? "font-medium text-red-700" : "text-muted"}`}>{pr.overdueItems}</Td>
                  <Td className="whitespace-nowrap align-middle">
                    <span className={`font-medium tabular-nums ${o.summary.display.scorePct < 80 ? "text-red-700" : ""}`}>{pct(o.summary.display.scorePct)}</span>
                    <div className="text-xs text-muted">
                      第 {o.current.quarter} 季{o.summary.assessment ? " · 已结算" : ""}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
