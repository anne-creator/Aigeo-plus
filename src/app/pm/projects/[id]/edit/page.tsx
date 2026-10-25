import { notFound } from "next/navigation";
import { Alert, Card, CardTitle, LinkButton, PageHeader } from "@/components/ui";
import { canAccessProject, requireSession } from "@/lib/auth";
import { labelOf, KPI_METRIC_TYPES } from "@/lib/rules";
import { loadPmProject, planTierLabel, projectHref, projectStatusLabel, usd } from "../../../_lib";
import { BasicsForm } from "./basics-form";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(["PM"]);
  const { id } = await params;
  const project = await loadPmProject(id);
  if (!project || !canAccessProject(session, project)) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="编辑基本信息"
        description={project.clientName}
        actions={
          <LinkButton href={projectHref(project.id)} variant="secondary">
            返回详情
          </LinkButton>
        }
      />

      <Alert tone="blue">
        项目经理只能修改客户名称、客户官网、客户来源与备注。开始日期、方案档位、月服务费、合同月数、承诺 KPI 与项目状态会影响交付节点和考核结果，建档后仅管理员可修改；如需调整请联系管理员。
      </Alert>
      <BasicsForm
        projectId={project.id}
        cancelHref={projectHref(project.id)}
        initial={{ clientName: project.clientName, websiteUrl: project.websiteUrl, source: project.source, notes: project.notes ?? "" }}
      />

        <Card>
          <CardTitle>仅管理员可修改（只读）</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">项目开始日期</dt>
            <dd>{project.startDate}</dd>
            <dt className="text-muted">方案档位</dt>
            <dd>{planTierLabel(project.planTier)}</dd>
            <dt className="text-muted">月服务费</dt>
            <dd>{usd(project.monthlyFeeUsd)}</dd>
            <dt className="text-muted">合同月数</dt>
            <dd>{project.contractMonths} 个月</dd>
            <dt className="text-muted">项目状态</dt>
            <dd>{projectStatusLabel(project.status)}</dd>
            <dt className="text-muted">承诺交付 KPI</dt>
            <dd>
              {project.kpis.length === 0 ? (
                "—"
              ) : (
                <ul className="list-disc space-y-0.5 pl-4">
                  {project.kpis.map((k) => (
                    <li key={k.id}>
                      {k.name}：{k.targetValue} {k.unit}
                      <span className="ml-1 text-xs text-muted">（{labelOf(KPI_METRIC_TYPES, k.metricType)}）</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>
        </Card>

    </div>
  );
}
