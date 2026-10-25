import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Button, Card, CardTitle, Empty, Input, LinkButton, PageHeader, Stat, StatusBadge, Table, Td, Th } from "@/components/ui";
import { canAccessProject, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TimelineItemWithScore } from "@/lib/deliverables";
import { round2, scoreDeliverable } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { formatBj, toBjYmd } from "@/lib/time";
import { TimelineDiffView } from "@/components/timeline-diff";
import { diffTimeline, parseProposedJson } from "@/lib/timeline";
import { TimelineStatusCell } from "../../../_components";
import {
  canEditTimelineItem,
  canUndoTimelineItem,
  isLateTimelineItem,
  isLiveStatus,
  loadPmProject,
  loadTimeline,
  projectHref,
  projectStatusLabel,
  shortYmd,
  sp,
} from "../../../_lib";
import {
  completeTimelineItemAction,
  deleteTimelineItemAction,
  saveTimelineAction,
  submitTimelineRevisionAction,
  undoTimelineItemAction,
  updateTimelineItemAction,
  withdrawTimelineRevisionAction,
} from "./actions";
import { ConfirmButton } from "./confirm-button";
import { TimelineRowsEditor } from "./rows-editor";

const rowTint: Record<TimelineItemWithScore["score"]["status"], string> = {
  DONE: "",
  TODO: "",
  GRACE: "bg-amber-50/60",
  OVERDUE: "bg-red-50/70",
};

export default async function TimelinePage({
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
  const [items, nodes, revisions] = await Promise.all([
    loadTimeline(project.id, config, now),
    prisma.deliverable.findMany({ where: { projectId: project.id, seq: 1, code: { in: ["PROJECT_TIMELINE", "BASELINE_PLAN"] } } }),
    prisma.timelineRevision.findMany({
      where: { projectId: project.id, status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
      include: { reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  const pending = revisions.find((r) => r.status === "PENDING") ?? null;
  const lastDecided = revisions.find((r) => r.status !== "PENDING") ?? null;
  const pendingDiff = pending ? diffTimeline(items, parseProposedJson(pending.itemsJson)) : null;
  const node = nodes.find((d) => d.code === "PROJECT_TIMELINE");
  const baseline = nodes.find((d) => d.code === "BASELINE_PLAN");
  const nodeScore = node ? scoreDeliverable(node, config, now) : null;
  const baselineApproved = baseline?.reviewStatus === "APPROVED";
  const editable = session.role === "ADMIN" || isLiveStatus(project.status);

  const done = items.filter((t) => t.score.status === "DONE").length;
  const late = items.filter(isLateTimelineItem);
  const deducting = late.filter((t) => t.score.status === "OVERDUE").length;
  const deduction = round2(items.reduce((s, t) => s + t.score.deduction, 0));
  const openItems = items.filter((t) => !t.completedAt).map((t) => ({ dueDate: t.dueDate, title: t.title }));
  const months = Array.from(new Set(items.map((t) => t.dueDate.slice(0, 7))));

  const error = sp(q.error);
  const saved = sp(q.saved);
  const ok = sp(q.ok);
  const { graceDays, penaltyPerDayPct, weight } = config.timeline;

  return (
    <div className="space-y-6">
      <PageHeader
        title="项目 timeline"
        description={
          <>
            <Link href={projectHref(project.id)} className="hover:underline">
              {project.clientName}
            </Link>
            {nodeScore ? (
              <>
                {" "}
                · <StatusBadge status={nodeScore.status} />
                <span className="ml-1 text-xs">首次录入截止 {node ? shortYmd(toBjYmd(node.dueAt)) : ""}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <LinkButton href={projectHref(project.id)} variant="secondary">
            返回项目
          </LinkButton>
        }
      />

      <p className="text-sm text-muted">
        上传 Word 或 PDF，自动提取 timeline，再核对日期、事项并确认。首次确认后同步到客户时间轴、你的日历和当日 checklist。之后要改日期或增删节点，提交修改申请，管理员通过后生效。迟完成超过 {graceDays} 天开始扣分（每天扣 {penaltyPerDayPct}%，每条 {weight} 分）。
      </p>

      {!baselineApproved ? <Alert tone="amber">基线报告尚未确认，仍可先录入。</Alert> : null}
      {!editable ? <Alert tone="amber">项目已{projectStatusLabel(project.status)}，timeline 只读。</Alert> : null}
      {saved ? <Alert tone="green">已确认 {saved} 个节点，已同步到客户时间轴、你的日历和当日 checklist。</Alert> : null}
      {ok ? <Alert tone="green">{ok}</Alert> : null}
      {error ? <Alert tone="red">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="总条目" value={items.length} />
        <Stat label="已完成" value={done} tone={items.length > 0 && done === items.length ? "green" : undefined} />
        <Stat label="超期" value={late.length} tone={late.length > 0 ? "red" : undefined} hint={deducting > 0 ? `其中 ${deducting} 条已开始扣分` : "已过截止、未完成"} />
        <Stat label="本条目扣分合计" value={deduction.toFixed(2)} tone={deduction > 0 ? "red" : undefined} hint="截至目前，未完成的仍在增加" />
      </div>

      {editable && items.length === 0 ? (
        <Card>
          <CardTitle>导入 timeline</CardTitle>
          <p className="mb-3 text-xs text-muted">先上传文件生成预览，也可以直接手动填写。</p>
          <TimelineRowsEditor action={saveTimelineAction} projectId={project.id} initial={[]} minDate={project.startDate} mode="create" />
        </Card>
      ) : null}

      {pending && pendingDiff ? (
        <Card className="border-amber-300">
          <CardTitle
            right={
              editable ? (
                <form action={withdrawTimelineRevisionAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <ConfirmButton message="撤回这份修改申请？" className="text-xs text-muted hover:underline">
                    撤回
                  </ConfirmButton>
                </form>
              ) : null
            }
          >
            修改申请 · 等待管理员审批
          </CardTitle>
          <p className="mb-3 text-xs text-muted">
            {formatBj(pending.createdAt)} 提交 · 原因：{pending.reason ?? "—"}
            。通过前，日历和扣分仍按当前 timeline。
          </p>
          <TimelineDiffView diff={pendingDiff} />
        </Card>
      ) : null}

      {!pending && lastDecided ? (
        <Alert tone={lastDecided.status === "APPROVED" ? "green" : "red"}>
          上一次修改申请（{formatBj(lastDecided.createdAt)}）
          {lastDecided.status === "APPROVED"
            ? `已通过：${lastDecided.appliedSummary ?? ""}`
            : `被驳回${lastDecided.reviewNote ? `：${lastDecided.reviewNote}` : ""}`}
          {lastDecided.reviewedBy ? `（${lastDecided.reviewedBy.name}）` : ""}
        </Alert>
      ) : null}

      {editable && items.length > 0 ? (
        <Card>
          <details open>
            <summary className="cursor-pointer text-base font-semibold">
              修改 timeline <span className="ml-1 text-xs font-normal text-muted">上传新版文件或直接修改，管理员审批通过后生效</span>
            </summary>
            <div className="mt-4">
              <p className="mb-3 text-xs text-muted">可以上传新版 Word / PDF，追加或替换当前未完成节点。确认提交后由管理员审批，已完成节点保留不动。</p>
              <TimelineRowsEditor
                action={submitTimelineRevisionAction}
                projectId={project.id}
                initial={openItems}
                minDate={project.startDate}
                mode="revise"
                replacesPending={Boolean(pending)}
              />
            </div>
          </details>
        </Card>
      ) : null}

      <Card>
        <CardTitle right={<span className="text-xs text-muted">按截止日排序 · 北京时间</span>}>条目</CardTitle>
        {items.length === 0 ? (
          <Empty>还没有节点。{editable ? "在上方上传文件或手动录入。" : ""}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="whitespace-nowrap">日期</Th>
                <Th>事项</Th>
                <Th>状态</Th>
                <Th className="whitespace-nowrap">操作</Th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const rows = items.filter((t) => t.dueDate.slice(0, 7) === m);
                const mDone = rows.filter((t) => t.score.status === "DONE").length;
                return [
                  <tr key={`m-${m}`}>
                    <Td colSpan={4} className="bg-zinc-50 text-xs font-semibold text-muted">
                      {m} · 已完成 {mDone} / {rows.length}
                    </Td>
                  </tr>,
                  ...rows.map((t) => {
                    const canEdit = editable && canEditTimelineItem(session, t, today);
                    const canUndo = editable && canUndoTimelineItem(session, t, today);
                    const isToday = t.dueDate === today && t.score.status !== "DONE";
                    return (
                      <tr id={`item-${t.id}`} key={t.id} className={isToday ? "bg-blue-50/60" : rowTint[t.score.status]}>
                        <Td className="whitespace-nowrap">{shortYmd(t.dueDate)}</Td>
                        <Td className="min-w-48">
                          <span className={t.score.status === "DONE" ? "text-muted line-through" : "font-medium"}>{t.title}</span>
                          {canEdit ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-accent">编辑</summary>
                              <form action={updateTimelineItemAction} className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="id" value={t.id} />
                                <Input type="date" name="dueDate" defaultValue={t.dueDate} required className="sm:w-40" aria-label="日期" />
                                <Input name="title" defaultValue={t.title} required maxLength={200} className="sm:flex-1" aria-label="事项" />
                                <Button type="submit" variant="secondary">
                                  保存
                                </Button>
                              </form>
                            </details>
                          ) : null}
                        </Td>
                        <Td>
                          <TimelineStatusCell t={t} today={today} />
                        </Td>
                        <Td className="whitespace-nowrap">
                          {!editable ? (
                            <span className="text-muted">—</span>
                          ) : t.score.status === "DONE" ? (
                            canUndo ? (
                              <form action={undoTimelineItemAction} className="inline">
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="id" value={t.id} />
                                <button type="submit" className="text-xs text-muted hover:underline">
                                  撤销
                                </button>
                              </form>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )
                          ) : (
                            <div className="flex items-center gap-3">
                              <form action={completeTimelineItemAction} className="inline">
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="id" value={t.id} />
                                <Button type="submit" variant={isToday || isLateTimelineItem(t) ? "primary" : "secondary"} className="px-3 py-1 text-xs">
                                  ✓ 完成
                                </Button>
                              </form>
                              {canEdit ? (
                                <form action={deleteTimelineItemAction} className="inline">
                                  <input type="hidden" name="projectId" value={project.id} />
                                  <input type="hidden" name="id" value={t.id} />
                                  <ConfirmButton message={`删除「${t.title}」？`} className="text-xs text-red-700 hover:underline">
                                    删除
                                  </ConfirmButton>
                                </form>
                              ) : null}
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted">
          完成时间 = 勾选时间；当天勾错可撤销。改日期或增删条目请用上方「修改 timeline」，管理员审批通过后生效。
        </p>
      </Card>
    </div>
  );
}
