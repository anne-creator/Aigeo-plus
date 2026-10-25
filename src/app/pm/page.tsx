import Link from "next/link";
import { Badge, Card, CardTitle, Empty, LinkButton, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { addDays, toBjYmd } from "@/lib/time";
import { ProgressBar } from "./_components";
import { LIVE_STATUSES, loadPmProjects, nodeHref, planTierLabel, projectHref, shortYmd, timelineHref, type PmProjectOverview } from "./_lib";
import { TimelineDots } from "./_timeline-visual";

const MAX_ROWS = 6;

/** 已逾期：系统节点与 timeline 条目统一成同一形状 */
interface LateRow {
  key: string;
  title: string;
  client: string;
  dueYmd: string;
  lateDays: number;
  /** timeline 条目仍在宽限期内（暂不扣分） */
  grace: boolean;
  deduction: number;
  href: string;
}

function lateRows(overviews: PmProjectOverview[]): LateRow[] {
  const rows: LateRow[] = [];
  for (const o of overviews) {
    const pid = o.project.id;
    for (const d of o.overdue) {
      rows.push({
        key: d.id,
        title: d.title,
        client: o.project.clientName,
        dueYmd: toBjYmd(d.dueAt),
        lateDays: d.score.lateDays,
        grace: false,
        deduction: d.score.totalDeduction,
        href: nodeHref(pid, d),
      });
    }
    for (const t of o.timelineLate) {
      rows.push({
        key: t.id,
        title: t.title,
        client: o.project.clientName,
        dueYmd: t.dueDate,
        lateDays: t.score.lateDays,
        grace: t.score.status === "GRACE",
        deduction: t.score.deduction,
        href: timelineHref(pid),
      });
    }
  }
  return rows.sort((a, b) => (a.dueYmd < b.dueYmd ? -1 : a.dueYmd > b.dueYmd ? 1 : 0));
}

/** 今天起 7 天内到期、尚未完成的节点与 timeline 条目 */
function dueThisWeek(overviews: PmProjectOverview[], today: string): number {
  const end = addDays(today, 6);
  const inRange = (ymd: string) => ymd >= today && ymd <= end;
  return overviews.reduce(
    (n, o) =>
      n +
      o.items.filter((d) => !d.firstSubmittedAt && inRange(toBjYmd(d.dueAt))).length +
      o.timeline.filter((t) => !t.completedAt && inRange(t.dueDate)).length,
    0,
  );
}

function ProjectCard({ o, today }: { o: PmProjectOverview; today: string }) {
  const { project, progress: p, next } = o;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={projectHref(project.id)} className="block truncate font-semibold hover:underline">
            {project.clientName}
          </Link>
          <div className="mt-0.5 text-xs text-muted">
            {planTierLabel(project.planTier)} · {p.dayIndex === 0 ? "未开始" : `第 ${p.dayIndex} 天`} / {p.totalDays} 天
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {project.status === "PAUSED" ? <Badge tone="amber">已暂停</Badge> : null}
          {p.overdueItems > 0 ? <Badge tone="red">逾期 {p.overdueItems}</Badge> : null}
        </div>
      </div>

      <div className="mt-4">
        <TimelineDots projectId={project.id} items={o.items} today={today} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={p.donePct} />
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{p.donePct}%</span>
      </div>

      <div className="mt-3 truncate text-sm">
        {next ? (
          <Link href={next.href} className="hover:text-accent">
            <span className="text-muted">下一步：</span>
            <span className="tabular-nums">{next.date.slice(5)}</span> {next.title}
          </Link>
        ) : (
          <span className="text-muted">没有待办</span>
        )}
      </div>
    </Card>
  );
}

export default async function PmHomePage() {
  const session = await requireSession(["PM"]);
  const { overviews, now } = await loadPmProjects(session, { statuses: LIVE_STATUSES });
  const today = toBjYmd(now);

  const late = lateRows(overviews);
  const rejected = overviews.flatMap((o) => o.rejected.map((d) => ({ o, d })));
  const soon = dueThisWeek(overviews, today);

  return (
    <div className="space-y-8">
      <PageHeader
        title="待办与提醒"
        description={`${session.name}，今天 ${shortYmd(today)}`}
        actions={<LinkButton href="/pm/projects/new">新建客户档案</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="进行中项目" value={overviews.length} />
        <Stat label="已逾期" value={late.length} tone={late.length > 0 ? "red" : undefined} />
        <Stat label="7 天内到期" value={soon} />
        <Stat label="待重交" value={rejected.length} tone={rejected.length > 0 ? "red" : undefined} />
      </div>

      {overviews.length === 0 ? (
        <Empty>
          还没有进行中的项目。
          <Link href="/pm/projects/new" className="ml-1 text-accent hover:underline">
            新建客户档案 →
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {overviews.map((o) => (
            <ProjectCard key={o.project.id} o={o} today={today} />
          ))}
        </div>
      )}

      <Card>
        <CardTitle right={late.length > 0 ? <span className="text-xs text-muted">扣分为预估，每拖一天增加</span> : null}>已逾期</CardTitle>
        {late.length === 0 ? (
          <p className="text-sm text-muted">没有逾期事项。</p>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="min-w-44">事项</Th>
                  <Th>截止</Th>
                  <Th>逾期</Th>
                  <Th>扣分</Th>
                </tr>
              </thead>
              <tbody>
                {late.slice(0, MAX_ROWS).map((r) => (
                  <tr key={r.key}>
                    <Td>
                      <Link href={r.href} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <div className="text-xs text-muted">{r.client}</div>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{r.dueYmd.slice(5)}</Td>
                    <Td className={`whitespace-nowrap font-medium ${r.grace ? "text-amber-700" : "text-red-700"}`}>
                      {r.lateDays} 天{r.grace ? <span className="ml-1 text-xs font-normal">宽限中</span> : null}
                    </Td>
                    <Td className={`whitespace-nowrap tabular-nums ${r.deduction > 0 ? "text-red-700" : "text-muted"}`}>{r.deduction.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {late.length > MAX_ROWS ? <p className="mt-2 text-xs text-muted">还有 {late.length - MAX_ROWS} 项，见各项目详情。</p> : null}
          </>
        )}
      </Card>

      {rejected.length > 0 ? (
        <Card>
          <CardTitle>审核不通过，需重交</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th className="min-w-44">节点</Th>
                <Th>审核意见</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {rejected.slice(0, MAX_ROWS).map(({ o, d }) => (
                <tr key={d.id}>
                  <Td>
                    <Link href={nodeHref(o.project.id, d)} className="font-medium hover:underline">
                      {d.title}
                    </Link>
                    <div className="text-xs text-muted">{o.project.clientName}</div>
                  </Td>
                  <Td className="max-w-md whitespace-pre-wrap text-muted">{d.reviewNote ?? "—"}</Td>
                  <Td className="whitespace-nowrap">
                    <Link href={nodeHref(o.project.id, d)} className="text-accent hover:underline">
                      重新提交
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {rejected.length > MAX_ROWS ? <p className="mt-2 text-xs text-muted">还有 {rejected.length - MAX_ROWS} 项，见各项目详情。</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
