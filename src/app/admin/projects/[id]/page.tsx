import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, CardTitle, Empty, Field, Input, LinkButton, Select, StatusBadge, Table, Td, Textarea, Th, money, pct } from "@/components/ui";
import { CLIENT_SOURCES } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { getProjectDeliverables, getQuarterSummary, projectQuarters } from "@/lib/deliverables";
import { KPI_METRIC_TYPES, PLAN_TIERS, PROJECT_STATUSES, labelOf, quarterOfDate, round2, scoreTimelineItem } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { dutyRoleLabel } from "@/lib/tasks";
import { addDays, endOfDayBj, formatBj, formatBjDate, toBjYmd } from "@/lib/time";
import { projectProgress } from "@/lib/timeline";
import { BonusRules, DeliverableTimeline, MoneyLine, ProgressBlock, ProjectHeader, TaskStatusBadge, TimelineItemsTable } from "../../_components";
import { RENEWAL_STATUSES, latestSubmissionsFor, one, timelineLateText } from "../../_lib";
import { addKpi, deleteKpi, finalizeAssessment, saveAssessment, unfinalizeAssessment, updateProject } from "../actions";
import { addTimelineItem } from "./timeline-actions";
import { TimelineRevisionQueue } from "../../reviews/timeline-revisions";

export default async function AdminProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = one(sp.error);
  const saved = one(sp.saved);
  const now = new Date();

  const project = await prisma.project.findUnique({
    where: { id },
    include: { kpis: { orderBy: { id: "asc" } }, pm: { select: { name: true } }, assessments: true },
  });
  if (!project) notFound();

  const [config, pms, quarters, deliverables, timelineRaw, tasks] = await Promise.all([
    getRulesConfig(),
    prisma.user.findMany({ where: { OR: [{ role: "PM", active: true }, { id: project.pmId }] }, orderBy: { name: "asc" } }),
    projectQuarters(id),
    getProjectDeliverables(id, undefined, now),
    prisma.timelineItem.findMany({
      where: { projectId: id },
      include: { createdBy: { select: { name: true } }, completedBy: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.internTask.findMany({
      where: { projectId: id },
      include: { assignee: { select: { name: true, dutyRole: true } }, _count: { select: { submissions: true } } },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const qs = quarters.length ? quarters : [1];
  const summaries = await Promise.all(qs.map((q) => getQuarterSummary(project, q, { config, asOf: now })));
  const latest = await latestSubmissionsFor(deliverables.map((d) => d.id));
  const back = `/admin/projects/${id}`;
  const finalizedQuarters = new Set(project.assessments.filter((x) => x.finalizedAt).map((x) => x.quarter));
  const terminationQuarter = ["PAUSED", "TERMINATED"].includes(project.status) && project.terminationDate ? quarterOfDate(project.startDate, project.terminationDate) : null;
  const timelineItems = timelineRaw.map((t) => ({ ...t, score: scoreTimelineItem(t, config, now) }));
  const timelineNode = deliverables.find((d) => d.code === "PROJECT_TIMELINE") ?? null;
  const progress = projectProgress(project, deliverables, timelineRaw, now);
  const todayYmd = toBjYmd(now);

  return (
    <>
      <ProjectHeader
        project={project}
        pmName={project.pm.name}
        actions={
          <>
            <LinkButton href={`/pm/projects/${id}`} variant="secondary">
              以 PM 视角查看
            </LinkButton>
            <LinkButton href="/admin/projects" variant="secondary">
              返回列表
            </LinkButton>
          </>
        }
      />
      <ProgressBlock p={progress} />
      {error ? (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <Alert tone="green">已保存。</Alert>
        </div>
      ) : null}

      <nav className="mb-4 flex flex-wrap gap-3 text-sm">
        <a href="#profile" className="underline">
          客户档案
        </a>
        <a href="#kpis" className="underline">
          承诺 KPI
        </a>
        <a href="#project-timeline" className="underline">
          项目 timeline
        </a>
        <a href="#tasks" className="underline">
          负责人任务
        </a>
        <a href="#assessments" className="underline">
          季度考核与结算
        </a>
        <a href="#timeline" className="underline">
          交付时间线与审核
        </a>
      </nav>

      {/* ------------------------------ a. 客户档案 ------------------------------ */}
      <Card id="profile" className="scroll-mt-20">
        <CardTitle>客户档案编辑</CardTitle>
        <form action={updateProject.bind(null, id)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="客户名称">
              <Input name="clientName" defaultValue={project.clientName} required maxLength={200} />
            </Field>
            <Field label="客户官网" hint="选填，例如 acme.com">
              <Input name="websiteUrl" maxLength={300} placeholder="acme.com" defaultValue={project.websiteUrl} />
            </Field>
            <Field label="项目经理">
              <Select name="pmId" defaultValue={project.pmId} required>
                {pms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.username}）{!u.active ? " · 已停用" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="客户来源" hint="渠道方只能看到来源为本渠道的客户">
              <Select name="source" defaultValue={project.source} required>
                {CLIENT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="项目开始日期（D0）">
              <Input name="startDate" type="date" defaultValue={project.startDate} required />
            </Field>
            <Field label="方案档位">
              <Select name="planTier" defaultValue={project.planTier} required>
                {PLAN_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="月服务费（美元）">
              <Input name="monthlyFeeUsd" type="number" min={0} step="0.01" defaultValue={project.monthlyFeeUsd} required />
            </Field>
            <Field label="合同月数" hint="续约时增加月数，系统自动补生成后续节点">
              <Input name="contractMonths" type="number" min={1} max={120} step={1} defaultValue={project.contractMonths} required />
            </Field>
            <Field label="项目状态">
              <Select name="status" defaultValue={project.status} required>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="暂停/终止日" hint="状态为已暂停/已终止时必填，不得早于开始日期；之后的节点不再要求。改回进行中会自动清空">
              <Input name="terminationDate" type="date" defaultValue={project.terminationDate ?? ""} />
            </Field>
            <Field label="续约状态" hint="上一期结束后 90 天内续签视为续约成功，供续约奖人工结算">
              <Select name="renewalStatus" defaultValue={project.renewalStatus ?? "NONE"}>
                {RENEWAL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="续约时长（月）" hint="续约奖 = 月提成 × 续约月数 ÷ 3；客户提前终止按实际服务并回款的月数填写">
              <Input name="renewalMonths" type="number" min={1} max={60} step={1} defaultValue={project.renewalMonths ?? ""} placeholder="续约成功后填写" />
            </Field>
            <div>
              <Field label="续约备注（选填）">
                <Input name="renewalNote" defaultValue={project.renewalNote ?? ""} />
              </Field>
            </div>
          </div>
          <Field label="备注（选填）">
            <Textarea name="notes" defaultValue={project.notes ?? ""} className="min-h-20" />
          </Field>
          <Alert tone="amber">修改开始日期或合同月数会重新生成交付节点；已有提交的节点保留。</Alert>
          <div className="flex items-center gap-3">
            <Button type="submit">保存档案</Button>
            <span className="text-xs text-muted">建档 {formatBj(project.createdAt)} · 最近更新 {formatBj(project.updatedAt)}</span>
          </div>
        </form>
      </Card>

      {/* ------------------------------ b. 承诺 KPI ------------------------------ */}
      <Card id="kpis" className="mt-6 scroll-mt-20">
        <CardTitle>承诺交付 KPI</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>指标类型</Th>
              <Th>指标名</Th>
              <Th>目标值</Th>
              <Th>单位</Th>
              <Th>说明</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {project.kpis.map((k) => (
              <tr key={k.id}>
                <Td>
                  {labelOf(KPI_METRIC_TYPES, k.metricType)}
                  {k.metricType === "SHOWUP_RATE" ? <Badge tone="blue" className="ml-2">KPI 奖依据</Badge> : null}
                </Td>
                <Td>{k.name}</Td>
                <Td>{k.targetValue}</Td>
                <Td>{k.unit}</Td>
                <Td className="text-xs text-muted">{k.note ?? ""}</Td>
                <Td>
                  <form action={deleteKpi.bind(null, id, k.id)}>
                    <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-red-700">
                      删除
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
            {project.kpis.length === 0 ? (
              <tr>
                <Td colSpan={6} className="text-center text-muted">
                  还没有 KPI，请至少添加一条「提示词池 ShowUp 率」
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <form action={addKpi.bind(null, id)} className="mt-4 grid gap-3 sm:grid-cols-6">
          <Select name="metricType" defaultValue="CUSTOM" required>
            {KPI_METRIC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input name="name" placeholder="指标名" required />
          <Input name="targetValue" type="number" step="0.01" placeholder="目标值" required />
          <Input name="unit" placeholder="单位（留空用默认）" />
          <Input name="note" placeholder="说明（选填）" />
          <Button type="submit" variant="secondary">
            添加 KPI
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">「提示词池 ShowUp 率」只保留一条（KPI 奖依据）：再次添加会覆盖现有目标值，而不是新增一条。</p>
      </Card>

      {/* ---------------------------- b2. 项目 timeline ---------------------------- */}
      <div className="mt-6">
        <TimelineRevisionQueue back={`/admin/projects/${project.id}#project-timeline`} projectId={project.id} />
      </div>
      <Card id="project-timeline" className="mt-6 scroll-mt-20">
        <CardTitle
          right={
            timelineNode ? (
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  节点截止 {toBjYmd(timelineNode.dueAt)} · 首次录入 {formatBj(timelineNode.firstSubmittedAt)}
                </span>
                <StatusBadge status={timelineNode.score.status} />
              </span>
            ) : null
          }
        >
          项目 timeline（PM 上传）
        </CardTitle>
        {timelineItems.length === 0 ? (
          <Empty>尚未上传</Empty>
        ) : (
          <TimelineItemsTable projectId={id} startDate={project.startDate} items={timelineItems} finalizedQuarters={finalizedQuarters} />
        )}
        <form action={addTimelineItem.bind(null, id)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input name="dueDate" type="date" defaultValue={todayYmd} required className="sm:w-44" />
          <Input name="title" placeholder="事项，如：提交 Reddit 内容" required maxLength={200} />
          <Button type="submit" variant="secondary" className="shrink-0">
            添加
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">
          每条 {config.timeline.weight} 分；截止后 {config.timeline.graceDays} 天内完成不扣，之后每天扣 {pct(config.timeline.penaltyPerDayPct, 0)}，扣满为止。
        </p>
      </Card>

      {/* ---------------------------- b3. 负责人任务（只读） ---------------------------- */}
      <Card id="tasks" className="mt-6 scroll-mt-20">
        <CardTitle
          right={
            <Link href="/admin/interns" className="text-xs text-accent hover:underline">
              全部负责人任务
            </Link>
          }
        >
          负责人任务（{tasks.length}）
        </CardTitle>
        {tasks.length === 0 ? (
          <Empty>暂无任务</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>负责人</Th>
                <Th>任务</Th>
                <Th>截止</Th>
                <Th>状态</Th>
                <Th>交付</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {t.assignee.name}
                    <div className="text-muted">{dutyRoleLabel(t.assignee.dutyRole)}</div>
                  </Td>
                  <Td className={t.status === "DONE" ? "text-muted" : ""}>{t.title}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatBjDate(t.dueAt)}</Td>
                  <Td>
                    <TaskStatusBadge task={t} now={now} />
                  </Td>
                  <Td className="text-xs">{t._count.submissions || <span className="text-muted">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* --------------------------- c. 季度考核与结算 --------------------------- */}
      <div id="assessments" className="mt-6 scroll-mt-20">
        <h2 className="mb-3 text-base font-semibold">季度考核与结算</h2>
        <div className="space-y-4">
          {summaries.map((s) => {
            const q = s.quarter;
            const a = project.assessments.find((x) => x.quarter === q) ?? null;
            const qStart = addDays(project.startDate, 90 * (q - 1));
            const qEnd = addDays(project.startDate, 90 * q - 1);
            const ended = now.getTime() > endOfDayBj(qEnd).getTime();
            const finalized = Boolean(a?.finalizedAt);
            const terminatedHere = terminationQuarter !== null && terminationQuarter <= q;
            const deducted = s.items.filter((it) => it.score.counted && it.score.totalDeduction > 0);
            const tlCounted = s.timelineItems.filter((t) => t.score.counted);
            const tlDeduction = round2(tlCounted.reduce((sum, t) => sum + t.score.deduction, 0));
            const tlShown = s.timelineItems.filter((t) => t.score.deduction > 0 || t.score.status === "OVERDUE" || t.score.status === "GRACE");
            // 已结算季度：得分以固化值为准；s.score 是按当前设置/审核状态的实时重算，只作参考
            const frozenScore = finalized && a ? a.deliveryScorePct : null;
            const shownScore = frozenScore ?? s.score.scorePct;
            const drifted = frozenScore !== null && Math.abs(frozenScore - s.score.scorePct) >= 0.01;
            return (
              <Card key={q} id={`q-${q}`} className="scroll-mt-20">
                <CardTitle
                  right={
                    finalized ? (
                      <Badge tone="green">已结算 · {formatBj(a?.finalizedAt)}</Badge>
                    ) : (
                      <Badge tone={ended ? "amber" : "blue"}>{ended ? "季度已结束，待结算" : "进行中（截至目前）"}</Badge>
                    )
                  }
                >
                  第 {q} 季度（{qStart} 至 {qEnd}）
                </CardTitle>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* 交付得分 */}
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted">季度交付得分{frozenScore !== null ? "（结算口径，已固化）" : "（截至目前）"}</div>
                        <div className={`mt-1 text-2xl font-semibold ${shownScore < 80 ? "text-amber-700" : ""}`}>{pct(shownScore)}</div>
                        {frozenScore === null ? (
                          <div className="text-xs text-muted">
                            = 1 − {s.score.totalDeduction} ÷ {s.score.totalWeight}
                          </div>
                        ) : drifted ? (
                          <div className="text-xs text-amber-700">按当前设置/审核重算为 {pct(s.score.scorePct)}，结算以固化值为准</div>
                        ) : (
                          <div className="text-xs text-muted">结算时固化，不随设置或审核变动</div>
                        )}
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted">计入节点</div>
                        <div className="mt-1 text-2xl font-semibold">
                          {s.score.countedItems}
                          <span className="text-sm text-muted"> / {s.score.totalItems}</span>
                        </div>
                        <div className="text-xs text-muted">未到期且未提交的不计入</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs">
                      <div className="mb-1 font-medium">扣分明细{frozenScore !== null ? "（按当前设置重算，仅供参考）" : ""}</div>
                      {deducted.length === 0 && tlShown.length === 0 ? (
                        <div className="text-muted">本季度暂无扣分</div>
                      ) : (
                        <ul className="space-y-0.5">
                          {deducted.map((it) => (
                            <li key={it.id} className="flex justify-between gap-3">
                              <a href={`#d-${it.id}`} className="truncate hover:underline">
                                {it.title}
                              </a>
                              <span className="whitespace-nowrap text-muted">
                                −{it.score.totalDeduction} / {it.score.weight}
                                {it.score.lateDays > 0 ? ` · 延期 ${it.score.lateDays} 天` : it.score.lateDays === -1 ? " · 未提交" : ""}
                                {it.score.reviewPct > 0 ? ` · 审核扣 ${pct(it.score.reviewPct, 0)}` : ""}
                                {it.score.projected ? "（预估）" : ""}
                              </span>
                            </li>
                          ))}
                          {tlShown.map((t) => (
                            <li key={t.id} className="flex justify-between gap-3">
                              <a href={`#t-${t.id}`} className="truncate hover:underline" title={`${t.dueDate} ${t.title}`}>
                                {t.dueDate.slice(5)} {t.title}
                              </a>
                              <span className={`whitespace-nowrap ${t.score.deduction > 0 ? "text-muted" : "text-amber-700"}`}>
                                −{t.score.deduction} / {t.score.weight} · {timelineLateText(t.score)}
                                {t.score.status === "OVERDUE" ? "（预估）" : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.timelineItems.length > 0 ? (
                        <div className="mt-1 text-muted">
                          timeline 条目：{tlCounted.length} 条计入 / {s.timelineItems.length} 条，扣 {tlDeduction} 分（已含在上方 Σ 里）
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* KPI 奖 */}
                  <div>
                    {project.monthlyFeeUsd > 5000 ? (
                      <div className="mb-3">
                        <Alert tone="amber">月服务费超过 $5,000：按薪酬规则另行约定，待单独约定，不适用标准 KPI 结算。</Alert>
                      </div>
                    ) : null}
                    {terminatedHere ? (
                      <div className="mb-3">
                        <Alert tone="red">项目已暂停或终止（生效日 {project.terminationDate}），按规则当季 KPI 奖不发放；结算时 KPI 奖记为 0。</Alert>
                      </div>
                    ) : null}
                    {finalized && a ? (
                      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-medium text-emerald-800">结算单（已固化）</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <span className="text-muted">实际 ShowUp 率</span>
                          <span>{pct(a.actualShowupRate)}</span>
                          <span className="text-muted">目标 ShowUp 率</span>
                          <span>{pct(a.targetShowupRate)}</span>
                          <span className="text-muted">效果达成率</span>
                          <span>{pct(a.achievementPct)}</span>
                          <span className="text-muted">档位系数</span>
                          <span>{pct(a.tierPct, 0)}</span>
                          <span className="text-muted">季度交付得分</span>
                          <span>{pct(a.deliveryScorePct)}</span>
                          <span className="text-muted">汇率</span>
                          <span>{a.fxRate}</span>
                        </div>
                        <MoneyLine label="月提成" value={a.monthlyCommissionCny} />
                        <MoneyLine label="季度 KPI 奖" value={a.kpiBonusCny} strong />
                        <div className="text-xs text-muted">
                          = {money(a.monthlyCommissionCny)} × {pct(a.tierPct, 0)} × {pct(a.deliveryScorePct)}
                        </div>
                        {a.note ? <div className="text-xs text-muted">备注：{a.note}</div> : null}
                        <form action={unfinalizeAssessment.bind(null, id, q)} className="pt-1">
                          <Button type="submit" variant="secondary" className="text-xs">
                            撤销结算
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <form action={saveAssessment.bind(null, id, q)} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="实际 ShowUp 率（%）" hint={`合同目标 ${pct(s.targetShowupRate)}`}>
                            <Input name="actualShowupRate" type="number" min={0} max={100} step="0.01" defaultValue={a?.actualShowupRate ?? ""} />
                          </Field>
                          <Field label="汇率（美元→人民币）" hint={`仅作估算；实际基数以薪酬页确认回款为准`}>
                            <Input name="fxRate" type="number" min={0.01} step="0.0001" defaultValue={a?.fxRate ?? config.fxRate} required />
                          </Field>
                        </div>
                        <Field label="备注（选填）">
                          <Input name="note" defaultValue={a?.note ?? ""} />
                        </Field>
                        <div className="rounded-lg border border-border p-3">
                          <div className="mb-1 text-xs font-medium">测算（截至目前）</div>
                          <p className="mb-2 text-xs text-muted">{s.receiptConfirmed ? "满奖基数：本季度实际月提成的平均值" : "回款未齐，基数按合同估算；结算前需确认各服务月回款"}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span className="text-muted">效果达成率</span>
                            <span>{pct(s.bonus.achievementPct)}</span>
                            <span className="text-muted">档位系数</span>
                            <span>{pct(s.bonus.tierPct, 0)}</span>
                            <span className="text-muted">季度交付得分</span>
                            <span>{pct(s.bonus.deliveryScorePct)}</span>
                          </div>
                          <MoneyLine label="月提成" value={s.bonus.monthlyCommissionCny} />
                          <MoneyLine label="季度 KPI 奖（测算）" value={terminatedHere ? 0 : s.bonus.kpiBonusCny} strong />
                        </div>
                        {!ended ? <div className="text-xs text-amber-700">季度尚未结束：结算口径下，所有未提交节点一律按扣满计算。</div> : null}
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" variant="secondary">
                            保存测算
                          </Button>
                          <Button type="submit" formAction={finalizeAssessment.bind(null, id, q)}>
                            结算并固化
                          </Button>
                        </div>
                      </form>
                    )}
                    <div className="mt-3">
                      <BonusRules commissionRate={config.commissionRate} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* --------------------------- d. 交付时间线与审核 --------------------------- */}
      <Card id="timeline" className="mt-6 scroll-mt-20">
        <CardTitle right={<span className="text-xs text-muted">共 {deliverables.length} 个节点 · 审核不通过默认扣该项权重 {pct(config.reviewRejectDeductionPct, 0)}</span>}>
          交付时间线与审核
        </CardTitle>
        {deliverables.length === 0 ? (
          <Empty>还没有生成交付节点（保存档案后自动生成）</Empty>
        ) : (
          <DeliverableTimeline items={deliverables} latest={latest} back={back} defaultRejectPct={config.reviewRejectDeductionPct} finalizedQuarters={finalizedQuarters} />
        )}
      </Card>
    </>
  );
}
