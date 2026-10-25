import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardTitle, LinkButton, PageHeader } from "@/components/ui";
import { canAccessProject, requireSession } from "@/lib/auth";
import { getProjectDeliverables, projectQuarters } from "@/lib/deliverables";
import { labelOf, KPI_METRIC_TYPES, projectEndDate } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { projectProgress } from "@/lib/timeline";
import { toBjYmd } from "@/lib/time";
import { Collapsible, DeliverableTable, NextSteps, nextUnsubmitted, QuarterCard, TimelineStatusCell } from "../../_components";
import {
  isLiveStatus,
  loadPmProject,
  loadQuarterSummary,
  loadTimeline,
  planTierLabel,
  projectStatusLabel,
  projectStatusTone,
  shortYmd,
  sp,
  timelineHref,
  usd,
  type PmQuarterSummary,
} from "../../_lib";
import { TimelineLegend, TimelineVisual } from "../../_timeline-visual";
import { ShareCard } from "@/components/client-view/share-card";
import { websiteHref } from "@/lib/web";

const NEXT_STEPS = 3;
const NEXT_TIMELINE = 5;

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession(["PM"]);
  const { id } = await params;
  const q = await searchParams;
  const project = await loadPmProject(id);
  if (!project || !canAccessProject(session, project)) notFound();

  const now = new Date();
  const today = toBjYmd(now);
  const config = await getRulesConfig();
  const [items, quarters, timeline] = await Promise.all([
    getProjectDeliverables(project.id, config, now),
    projectQuarters(project.id),
    loadTimeline(project.id, config, now),
  ]);
  const progress = projectProgress(project, items, timeline, now);
  const live = isLiveStatus(project.status);
  const next = nextUnsubmitted(items, NEXT_STEPS);
  const nextTimeline = timeline.filter((t) => !t.completedAt).slice(0, NEXT_TIMELINE);

  const summaries: PmQuarterSummary[] = [];
  for (const quarter of quarters) summaries.push(await loadQuarterSummary(project, quarter, config, now));
  // 已结算季度：明细表按结算口径展示（未提交一律扣满），与季度卡片一致
  const finalizedQuarters = new Set(summaries.filter((s) => s.assessment).map((s) => s.quarter));
  const finalItems = new Map(summaries.filter((s) => s.assessment).flatMap((s) => s.items.map((d) => [d.id, d] as const)));
  const tableItems = items.map((d) => finalItems.get(d.id) ?? d);

  const submittedId = sp(q.submitted);
  const submittedItem = submittedId ? items.find((d) => d.id === submittedId) : undefined;
  const error = sp(q.error);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.clientName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{planTierLabel(project.planTier)}</span>
            <span>{progress.dayIndex === 0 ? "尚未开始" : `第 ${progress.dayIndex} 天`} / 共 {progress.totalDays} 天</span>
            <span>
              完成 <span className="font-semibold text-foreground">{progress.donePct}%</span>
            </span>
            {progress.overdueItems > 0 ? <span className="font-medium text-red-700">逾期 {progress.overdueItems} 项</span> : null}
            {project.status !== "ACTIVE" ? <Badge tone={projectStatusTone(project.status)}>{projectStatusLabel(project.status)}</Badge> : null}
          </span>
        }
        actions={
          <LinkButton href={`/pm/projects/${project.id}/edit`} variant="secondary">
            编辑
          </LinkButton>
        }
      />

      {sp(q.created) ? <Alert tone="green">客户档案已创建，交付节点已生成。</Alert> : null}
      {sp(q.updated) ? <Alert tone="green">基本信息已更新。</Alert> : null}
      {submittedId ? <Alert tone="green">已提交：{submittedItem?.title ?? "材料"}</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
      {!live ? <Alert tone="amber">项目已{projectStatusLabel(project.status)}，不再接受提交。</Alert> : null}

      <Card>
        <CardTitle>交付时间线</CardTitle>
        <TimelineVisual projectId={project.id} items={items} today={today} timeline={timeline} />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TimelineLegend />
          <p className="text-xs text-muted">已确认的项目计划同步到客户时间轴；点击节点查看详情。</p>
        </div>
      </Card>

      <ShareCard projectId={project.id} shareToken={project.shareToken} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>下一步</CardTitle>
          {live ? <NextSteps items={next} projectId={project.id} today={today} /> : <p className="py-2 text-sm text-muted">项目已结束。</p>}
        </Card>

        <Card>
          <CardTitle
            right={
              <Link href={timelineHref(project.id)} className="text-sm text-accent hover:underline">
                {timeline.length === 0 ? "录入 →" : "管理 →"}
              </Link>
            }
          >
            项目 timeline
          </CardTitle>
          {timeline.length === 0 ? (
            <p className="py-2 text-sm text-muted">还没有条目。基线报告确认后上传，条目会进入你的日历。</p>
          ) : nextTimeline.length === 0 ? (
            <p className="py-2 text-sm text-emerald-700">全部 {timeline.length} 条已完成。</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {nextTimeline.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5">
                  <span className="w-11 shrink-0 tabular-nums text-muted">{t.dueDate.slice(5)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                  <span className="text-xs">
                    <TimelineStatusCell t={t} today={today} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {summaries.length > 0 ? (
        <div className={`grid gap-6 ${summaries.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {summaries.map((s) => (
            <QuarterCard key={s.quarter} summary={s} />
          ))}
        </div>
      ) : null}

      <Collapsible title="客户档案" hint={`${project.startDate} 开始 · ${project.contractMonths} 个月`}>
        <div className="grid gap-6 md:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">客户官网</dt>
            <dd className="break-all">
              {websiteHref(project.websiteUrl) ? (
                <a href={websiteHref(project.websiteUrl)!} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {project.websiteUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted">开始 / 结束</dt>
            <dd>
              {shortYmd(project.startDate)} → {shortYmd(projectEndDate(project.startDate, project.contractMonths))}
              {project.terminationDate ? <span className="ml-1 text-xs text-red-700">终止/暂停日 {project.terminationDate}</span> : null}
            </dd>
            <dt className="text-muted">方案档位</dt>
            <dd>{planTierLabel(project.planTier)}</dd>
            <dt className="text-muted">月服务费</dt>
            <dd>{usd(project.monthlyFeeUsd)}</dd>
            <dt className="text-muted">合同月数</dt>
            <dd>{project.contractMonths} 个月</dd>
            <dt className="text-muted">项目经理</dt>
            <dd>{project.pm.name}</dd>
            {project.renewalStatus ? (
              <>
                <dt className="text-muted">续约</dt>
                <dd>
                  {project.renewalStatus}
                  {project.renewalNote ? <span className="ml-1 text-xs text-muted">{project.renewalNote}</span> : null}
                </dd>
              </>
            ) : null}
            {project.notes ? (
              <>
                <dt className="text-muted">备注</dt>
                <dd className="whitespace-pre-wrap">{project.notes}</dd>
              </>
            ) : null}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">承诺交付 KPI</h3>
            {project.kpis.length === 0 ? (
              <p className="text-sm text-muted">未录入</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {project.kpis.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {k.name}
                      {k.metricType === "SHOWUP_RATE" ? (
                        <span className="ml-2 text-xs text-muted">KPI 奖依据</span>
                      ) : (
                        <span className="ml-2 text-xs text-muted">{labelOf(KPI_METRIC_TYPES, k.metricType)}</span>
                      )}
                    </span>
                    <span className="whitespace-nowrap font-medium">
                      {k.targetValue} {k.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">开始日期、档位、服务费、月数与 KPI 由管理员维护。</p>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="全部节点明细" hint={`${items.length} 项`}>
        <DeliverableTable items={tableItems} projectId={project.id} finalizedQuarters={finalizedQuarters} />
        <p className="mt-2 text-xs text-muted">
          每晚 1 天按日扣比例扣分，扣满为止；审核不通过另扣权重的 {config.reviewRejectDeductionPct}%。
        </p>
      </Collapsible>
    </div>
  );
}
