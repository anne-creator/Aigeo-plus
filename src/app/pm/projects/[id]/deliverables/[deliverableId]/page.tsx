import { UploadForm } from "@/components/upload-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Badge, Button, Card, CardTitle, Empty, Field, Input, LinkButton, PageHeader, ReviewBadge, StatusBadge, Table, Td, Textarea, Th } from "@/components/ui";
import { canAccessProject, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectDeliverables } from "@/lib/deliverables";
import { DELIVERABLE_META, scoreDeliverable, type DeliverableCode } from "@/lib/rules";
import { aiCredentialsConfigured, parseIssues } from "@/lib/ai-review";
import { getRulesConfig } from "@/lib/settings";
import { formatBj, toBjYmd } from "@/lib/time";
import { DueHint } from "../../../../_components";
import { deliverableHref, fileSize, formatBjWeekday, isLiveStatus, projectHref, projectStatusLabel, sp, timelineHref } from "../../../../_lib";
import { TimelineDots } from "../../../../_timeline-visual";

const PREVIEW_CHARS = 200;

export default async function DeliverablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; deliverableId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession(["PM"]);
  const { id, deliverableId } = await params;
  const q = await searchParams;

  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: {
      project: { select: { id: true, clientName: true, pmId: true, status: true } },
      submissions: { orderBy: { version: "desc" }, include: { submittedBy: { select: { name: true } } } },
    },
  });
  if (!d || d.projectId !== id || !canAccessProject(session, d.project)) notFound();
  // PROJECT_TIMELINE 节点没有上传表单：在 timeline 页维护条目，保存即视为提交
  if (d.kind === "TIMELINE") redirect(timelineHref(d.project.id));

  const now = new Date();
  const today = toBjYmd(now);
  const config = await getRulesConfig();
  const [all, aiReview, assessment] = await Promise.all([
    getProjectDeliverables(d.project.id, config, now),
    prisma.aiReview.findFirst({ where: { deliverableId: d.id }, orderBy: { createdAt: "desc" } }),
    prisma.quarterAssessment.findUnique({
      where: { projectId_quarter: { projectId: d.project.id, quarter: d.quarter } },
      select: { finalizedAt: true },
    }),
  ]);
  const score = scoreDeliverable(d, config, now);
  const meta = DELIVERABLE_META[d.code as DeliverableCode];
  const fullDays = score.penaltyPerDayPct > 0 ? Math.ceil(100 / score.penaltyPerDayPct) : null;
  const projectLive = isLiveStatus(d.project.status);
  const finalized = Boolean(assessment?.finalizedAt);
  const hasSubmission = d.submissions.length > 0;
  const self = deliverableHref(d.project.id, d.id);
  const submitted = sp(q.submitted);
  const error = sp(q.error);

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.title}
        description={
          <>
            <Link href={projectHref(d.project.id)} className="hover:underline">
              {d.project.clientName}
            </Link>
            {" · "}
            {d.periodLabel}
          </>
        }
        actions={
          <LinkButton href={projectHref(d.project.id)} variant="secondary">
            返回项目
          </LinkButton>
        }
      />

      <div className="-mt-3">
        <TimelineDots projectId={d.project.id} items={all} today={today} highlightId={d.id} />
      </div>

      {submitted ? <Alert tone="green">提交成功，已记录为 v{d.submissions[0]?.version ?? 1}。</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}
      {d.reviewStatus === "REJECTED" && d.reviewSource !== "AI" ? (
        <Alert tone="red">
          <span className="font-semibold">管理员审核不通过，请重新提交。</span>
          {d.reviewNote ? <span className="mt-1 block whitespace-pre-wrap">意见：{d.reviewNote}</span> : null}
        </Alert>
      ) : null}

      {d.reviewStatus === "PENDING" && (!aiReview || aiReview.submissionId !== d.submissions[0]?.id) ? (
        <Alert tone="blue">
          {config.aiReview.enabled && aiCredentialsConfigured() ? "AI 审核中，通常一两分钟内出结果，稍后刷新本页。" : "已提交，等待管理员审核。"}
        </Alert>
      ) : null}

      {aiReview && aiReview.submissionId === d.submissions[0]?.id && aiReview.verdict !== "ERROR" ? (
        <Card className={aiReview.verdict === "FAIL" ? "border-red-300" : "border-emerald-300"}>
          <CardTitle right={<span className="text-xs text-muted">{formatBj(aiReview.createdAt)}</span>}>AI 审核</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-3xl font-semibold tabular-nums ${aiReview.verdict === "FAIL" ? "text-red-600" : "text-emerald-700"}`}>{aiReview.score ?? "—"}</span>
            <span className="text-sm text-muted">/ 100 · 通过线 {config.aiReview.passScore}</span>
            {aiReview.verdict === "PASS" ? <Badge tone="green">通过</Badge> : <Badge tone="red">不通过 · 扣该项 {aiReview.deductionPct}%</Badge>}
            {d.reviewSource === "ADMIN" ? <span className="text-xs text-muted">（管理员已改判，以管理员结论为准）</span> : null}
          </div>
          <p className="mt-3 text-sm">{aiReview.summary}</p>
          {parseIssues(aiReview.issuesJson).length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {parseIssues(aiReview.issuesJson).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : null}
          {aiReview.verdict === "FAIL" && d.reviewSource === "AI" ? (
            <p className="mt-3 text-xs text-red-700">按上面的问题修改后重新提交，新版本会重新审核；当季 KPI 奖的扣除见「我的收入」。</p>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-muted">截止 </span>
            <span className="font-semibold">{formatBjWeekday(d.dueAt)}</span>
          </span>
          <StatusBadge status={score.status} />
          {score.status === "OPEN" ? <DueHint dueYmd={toBjYmd(d.dueAt)} today={today} /> : null}
          {score.status === "OVERDUE" ? <span className="font-medium text-red-700">{score.lateDays} 天</span> : null}
          {score.counted && score.totalDeduction > 0 ? (
            <span className="font-medium text-red-700">
              扣 {score.totalDeduction.toFixed(2)} / {score.weight} 分{score.projected ? "（仍在增加）" : ""}
            </span>
          ) : null}
          {d.reviewStatus !== "NONE" ? <ReviewBadge status={d.reviewStatus} /> : null}
        </div>
        <p className="mt-2 text-xs text-muted">
          权重 {score.weight} 分，每晚 1 天扣 {score.penaltyPerDayPct}%{fullDays ? `，${fullDays} 天扣满` : ""}。
          {meta ? ` ${meta.description}` : ""}
        </p>

        <div className="mt-5 border-t border-border pt-5">
          {!projectLive ? (
            <Alert tone="amber">项目已{projectStatusLabel(d.project.status)}，不再接受提交。</Alert>
          ) : finalized ? (
            <Alert tone="amber">第 {d.quarter} 季度已结算，不能再提交；如需补交请联系管理员。</Alert>
          ) : (
            <UploadForm action={`/api/deliverables/${d.id}/submit`} purpose="deliverable" targetId={d.id} className="space-y-4">
              <input type="hidden" name="redirect" value={self} />
              {d.kind === "TEXT" ? (
                <Field label="复盘内容">
                  <Textarea name="text" required className="min-h-40" placeholder={"上周完成了什么……\n本周计划什么……"} />
                </Field>
              ) : (
                <Field label="上传文件" hint="单个文件，不超过 50MB">
                  <Input type="file" name="file" required />
                </Field>
              )}
              <Field label="备注（选填）">
                <Input name="note" maxLength={300} placeholder="例如：客户已确认版本" />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="px-6">
                  {hasSubmission ? "提交新版本" : "提交"}
                </Button>
                <span className="text-xs text-muted">
                  {hasSubmission ? "追加新版本，首次提交时间不变。" : "提交时间以服务器时间为准，提交后不可删除。"}
                </span>
              </div>
            </UploadForm>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>提交历史</CardTitle>
        {d.submissions.length === 0 ? (
          <Empty>还没有提交。</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>版本</Th>
                <Th>提交</Th>
                <Th>内容</Th>
                <Th>备注</Th>
              </tr>
            </thead>
            <tbody>
              {d.submissions.map((s, i) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap">
                    v{s.version}
                    {i === 0 ? (
                      <Badge tone="blue" className="ml-2">
                        最新
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatBj(s.submittedAt)}
                    <div className="text-xs text-muted">
                      {s.submittedBy.name}
                      {d.firstSubmittedAt && s.submittedAt.getTime() === d.firstSubmittedAt.getTime() ? " · 首次提交" : ""}
                    </div>
                  </Td>
                  <Td className="max-w-xl">
                    {s.textContent ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {s.textContent.length > PREVIEW_CHARS ? `${s.textContent.slice(0, PREVIEW_CHARS)}…` : s.textContent}
                      </pre>
                    ) : s.fileName ? (
                      <span>
                        <a href={`/api/files/${s.id}`} className="text-accent hover:underline">
                          {s.fileName}
                        </a>
                        <span className="ml-2 text-xs text-muted">{fileSize(s.fileSize)}</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="max-w-xs whitespace-pre-wrap">{s.note ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
