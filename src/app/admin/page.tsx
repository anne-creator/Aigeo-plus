import Link from "next/link";
import { Badge, Card, CardTitle, Empty, PageHeader, ReviewBadge, Stat, StatusBadge, Table, Td, Th, pct } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getQuarterSummary } from "@/lib/deliverables";
import { deliverableStatus } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { formatBj, lateDays } from "@/lib/time";
import { projectProgress } from "@/lib/timeline";
import { ProgressCell } from "./_components";
import { RUNNING_STATUSES, bjWeekRange, currentQuarter, overdueCountByProject } from "./_lib";

export default async function AdminHome() {
  const now = new Date();
  const week = bjWeekRange(now);
  const running = { status: { in: [...RUNNING_STATUSES] } };

  const [config, activeCount, overdueTotal, pendingCount, weekDueCount, pms, projects, overdueByProject, recent] = await Promise.all([
    getRulesConfig(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.deliverable.count({ where: { firstSubmittedAt: null, dueAt: { lt: now }, project: running } }),
    prisma.deliverable.count({ where: { reviewStatus: "PENDING" } }),
    prisma.deliverable.count({ where: { dueAt: { gte: week.start, lte: week.end }, project: running } }),
    prisma.user.findMany({ where: { role: "PM" }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.project.findMany({
      include: {
        kpis: true,
        pm: { select: { name: true } },
        deliverables: { select: { dueAt: true, firstSubmittedAt: true } },
        timelineItems: { select: { dueDate: true, completedAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    overdueCountByProject(now),
    prisma.submission.findMany({
      take: 15,
      orderBy: { submittedAt: "desc" },
      include: { submittedBy: { select: { name: true } }, deliverable: { include: { project: { select: { id: true, clientName: true } } } } },
    }),
  ]);

  // 每个进行中项目的当前季度交付得分（live 口径）
  const scoreByProject = new Map<string, number>();
  await Promise.all(
    projects
      .filter((p) => p.status === "ACTIVE")
      .map(async (p) => {
        const s = await getQuarterSummary(p, currentQuarter(p, now), { config, asOf: now });
        scoreByProject.set(p.id, s.score.scorePct);
      }),
  );

  // 进行中/已暂停项目的进度（系统节点 + timeline 条目），逾期多的排前面
  const progressRows = projects
    .filter((p) => RUNNING_STATUSES.includes(p.status as (typeof RUNNING_STATUSES)[number]))
    .map((p) => ({ p, progress: projectProgress(p, p.deliverables, p.timelineItems, now) }))
    .sort((a, b) => b.progress.overdueItems - a.progress.overdueItems || a.progress.donePct - b.progress.donePct);

  const pmRows = pms.map((pm) => {
    const mine = projects.filter((p) => p.pmId === pm.id);
    const active = mine.filter((p) => p.status === "ACTIVE");
    const overdue = mine.filter((p) => RUNNING_STATUSES.includes(p.status as (typeof RUNNING_STATUSES)[number])).reduce((s, p) => s + (overdueByProject.get(p.id) ?? 0), 0);
    const scores = active.map((p) => scoreByProject.get(p.id)).filter((x): x is number => typeof x === "number");
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { pm, total: mine.length, active: active.length, overdue, avg };
  });

  return (
    <>
      <PageHeader title="总览" description={`北京时间 ${formatBj(now)} · 本周 ${week.startYmd} 至 ${week.endYmd}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="进行中项目" value={activeCount} hint={<Link href="/admin/projects?status=ACTIVE" className="underline">查看全部项目</Link>} />
        <Stat label="已逾期未提交节点" value={overdueTotal} tone={overdueTotal > 0 ? "red" : "green"} hint="进行中/已暂停项目，按北京时间截止" />
        <Stat label="待审核提交" value={pendingCount} tone={pendingCount > 0 ? undefined : "green"} hint={<Link href="/admin/reviews" className="underline">去审核</Link>} />
        <Stat label="本周截止节点" value={weekDueCount} hint="周一 00:00 至周日 23:59" />
      </div>

      <Card className="mt-6">
        <CardTitle right={<span className="text-xs text-muted">进度 = 已完成的系统节点 + timeline 条目</span>}>项目进度</CardTitle>
        {progressRows.length === 0 ? (
          <Empty>没有进行中的项目</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>客户</Th>
                <Th>项目经理</Th>
                <Th>进度</Th>
                <Th>当前季度得分</Th>
              </tr>
            </thead>
            <tbody>
              {progressRows.map(({ p, progress }) => {
                const score = scoreByProject.get(p.id);
                return (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">
                        {p.clientName}
                      </Link>
                      {p.status === "PAUSED" ? <Badge tone="amber" className="ml-2">已暂停</Badge> : null}
                    </Td>
                    <Td>{p.pm.name}</Td>
                    <Td>
                      <ProgressCell p={progress} />
                    </Td>
                    <Td>
                      {score === undefined ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={score < 80 ? "font-medium text-amber-700" : "font-medium"}>{pct(score)}</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardTitle>按项目经理</CardTitle>
        {pmRows.length === 0 ? (
          <Empty>还没有项目经理账号</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>项目经理</Th>
                <Th>项目数</Th>
                <Th>已逾期未提交</Th>
                <Th>当前季度平均交付得分</Th>
              </tr>
            </thead>
            <tbody>
              {pmRows.map((r) => (
                <tr key={r.pm.id}>
                  <Td>
                    <span className="font-medium">{r.pm.name}</span>
                    <span className="ml-2 text-xs text-muted">{r.pm.username}</span>
                    {!r.pm.active ? <Badge tone="zinc" className="ml-2">已停用</Badge> : null}
                  </Td>
                  <Td>
                    {r.total}
                    <span className="ml-1 text-xs text-muted">（进行中 {r.active}）</span>
                  </Td>
                  <Td className={r.overdue > 0 ? "font-medium text-red-600" : ""}>{r.overdue}</Td>
                  <Td>
                    {r.avg === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={r.avg < 80 ? "font-medium text-amber-700" : "font-medium"}>{pct(r.avg)}</span>
                    )}
                    <span className="ml-1 text-xs text-muted">截至目前，进行中项目</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardTitle>最近提交</CardTitle>
        {recent.length === 0 ? (
          <Empty>还没有任何提交</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>项目</Th>
                <Th>交付物</Th>
                <Th>提交人</Th>
                <Th>提交时间</Th>
                <Th>按时/延期</Th>
                <Th>审核</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const d = s.deliverable;
                const status = deliverableStatus(d, now);
                const late = d.firstSubmittedAt ? lateDays(d.dueAt, d.firstSubmittedAt) : 0;
                return (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/admin/projects/${d.project.id}`} className="underline">
                        {d.project.clientName}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/admin/projects/${d.project.id}#d-${d.id}`} className="font-medium hover:underline">
                        {d.title}
                      </Link>
                      <span className="ml-2 text-xs text-muted">第 {s.version} 版</span>
                    </Td>
                    <Td>{s.submittedBy.name}</Td>
                    <Td className="whitespace-nowrap">{formatBj(s.submittedAt)}</Td>
                    <Td>
                      <StatusBadge status={status} />
                      {late > 0 ? <span className="ml-1 text-xs text-amber-700">{late} 天</span> : null}
                    </Td>
                    <Td>
                      <ReviewBadge status={d.reviewStatus} />
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
