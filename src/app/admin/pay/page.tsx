import Link from "next/link";
import { Alert, Badge, Card, CardTitle, Empty, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { KeptBar, PayRules, yuan } from "@/components/pay-view";
import { aiCredentialsConfigured } from "@/lib/ai-review";
import { getPayroll, recentAiReviews } from "@/lib/pay";
import { getRulesConfig } from "@/lib/settings";
import { formatBj } from "@/lib/time";

const VERDICT = { PASS: { label: "通过", tone: "green" }, FAIL: { label: "不通过", tone: "red" }, ERROR: { label: "出错", tone: "amber" } } as const;

export default async function AdminPayPage() {
  const [rows, reviews, cfg] = await Promise.all([getPayroll(), recentAiReviews(30), getRulesConfig()]);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const aiOn = cfg.aiReview.enabled && aiCredentialsConfigured();

  return (
    <>
      <PageHeader title="薪酬与绩效" description="按《项目经理薪酬规则》核算；每个项目的月提成与回款依据在下方列示" />
      <div className="space-y-6">
        {!aiOn ? (
          <Alert tone="amber">
            {cfg.aiReview.enabled
              ? "AI 审核未生效：服务器没有配置 OPENAI_API_KEY，提交的材料会停在「待审核」，由管理员人工审核。"
              : "AI 审核已在系统设置中关闭，提交的材料由管理员人工审核。"}
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
          <Stat label="当前月收入参考合计" value={yuan(sum((r) => r.pay.monthlyFixed))} hint={`${rows.filter((r) => r.pay.base.source === "PENDING").length} 人底薪待录工时；月提成含合同估算`} />
          <Stat label="各项目当季 KPI 奖预计" value={yuan(sum((r) => r.pay.bonusProjected))} hint={`${rows.flatMap((r) => r.pay.projects).filter((p) => p.bonusPending).length} 个项目奖金待确认，未计入`} />
          <Stat label="AI 审核已扣除" value={sum((r) => r.pay.aiLost) > 0 ? `−${yuan(sum((r) => r.pay.aiLost))}` : "¥0"} tone={sum((r) => r.pay.aiLost) > 0 ? "red" : undefined} hint={`晚交/超期另扣 ${yuan(sum((r) => r.pay.lateLost))}`} />
          <Stat
            label="续约奖"
            value={yuan(sum((r) => r.pay.renewalTotal))}
            hint={`满足条件待发 ${yuan(sum((r) => r.pay.renewals.filter((x) => x.payable && !x.paidAt).reduce((a, x) => a + x.bonusCny, 0)))}`}
          />
        </div>

        <Card>
          <CardTitle>项目经理</CardTitle>
          {rows.length === 0 ? (
            <Empty>还没有项目经理账号。</Empty>
          ) : (
            <Table className="whitespace-nowrap">
              <thead>
                <tr>
                  <Th>姓名</Th>
                  <Th className="text-right">底薪</Th>
                  <Th className="text-right">月提成</Th>
                  <Th className="text-right">已知收入参考</Th>
                  <Th className="min-w-40">本季 KPI 奖</Th>
                  <Th className="text-right">AI 扣除</Th>
                  <Th className="text-right">晚交扣除</Th>
                  <Th className="text-right">续约奖</Th>
                  <Th className="text-right">按时率</Th>
                  <Th className="text-right">AI 均分</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pm, pay, perf }) => (
                  <tr key={pm.id}>
                    <Td>
                      <Link href={`/admin/pay/${pm.id}`} className="font-medium text-accent hover:underline">
                        {pm.name}
                      </Link>
                      <div className="text-xs text-muted">{pay.activeProjects} 个项目</div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {pay.base.source === "PENDING" ? "待确认" : yuan(pay.base.salary)}
                      {pay.base.source === "PENDING" ? <div className="text-xs text-amber-700">待录工时</div> : <div className="text-xs text-muted">日均 {pay.base.avgDailyHours}h</div>}
                    </Td>
                    <Td className="text-right tabular-nums">{yuan(pay.commissionTotal)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{yuan(pay.monthlyFixed)}</Td>
                    <Td>
                      <div className="flex justify-between text-xs tabular-nums">
                        <span className="font-semibold">{pay.projects.every((p) => p.bonusPending) ? "待确认" : yuan(pay.bonusProjected)}</span>
                        <span className="text-muted">/ {yuan(pay.bonusFull)}</span>
                      </div>
                      <div className="mt-1">
                        {pay.projects.some((p) => p.bonusPending) ? <span className="text-xs text-muted">{pay.projects.filter((p) => p.bonusPending).length} 个项目待录效果或约定金额</span> : <KeptBar kept={pay.bonusProjected} lost={pay.bonusLost} />}
                      </div>
                    </Td>
                    <Td className={`text-right tabular-nums ${pay.aiLost > 0 ? "text-red-600" : "text-muted"}`}>{pay.aiLost > 0 ? `−${yuan(pay.aiLost)}` : "—"}</Td>
                    <Td className={`text-right tabular-nums ${pay.lateLost > 0 ? "text-red-600" : "text-muted"}`}>{pay.lateLost > 0 ? `−${yuan(pay.lateLost)}` : "—"}</Td>
                    <Td className="text-right tabular-nums">{pay.renewalTotal > 0 ? yuan(pay.renewalTotal) : "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {perf.onTimePct === null ? "—" : `${perf.onTimePct}%`}
                      {perf.overdue > 0 ? <div className="text-xs text-red-600">{perf.overdue} 项逾期</div> : null}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {perf.aiAvgScore ?? "—"}
                      {perf.aiFailed > 0 ? <div className="text-xs text-red-600">{perf.aiFailed} 项未通过</div> : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted">
            底薪按当月日均有效工时分档（在姓名详情页录入）；月提成 = 实际人民币回款 × 10%（未回款按汇率 {cfg.fxRate} 估算）；KPI 奖 = 月提成 × 效果档位 × 交付得分，交付得分被晚交和审核不通过扣减；续约奖 = 月提成 × 续约月数 ÷ 3，续约期结束后发放。
          </p>
        </Card>

        <Card>
          <CardTitle right={<Badge tone="blue">月提成固定 10%</Badge>}>逐项目月收入明细</CardTitle>
          <p className="mb-3 text-xs text-muted">点击项目经理姓名可录入回款；季度预付款按服务月分摊。未录工时的底薪、大额项目的协议金额不计入参考合计。</p>
          <Table>
            <thead><tr><Th>项目 / 项目经理</Th><Th>当前服务月</Th><Th className="text-right">月服务费</Th><Th className="text-right">月提成</Th><Th>依据 / 状态</Th><Th className="text-right">含满奖及续约的月均参考</Th></tr></thead>
            <tbody>{rows.flatMap(({ pm, pay }) => pay.projects.map((p) => <tr key={p.projectId}>
              <Td><Link href={`/admin/projects/${p.projectId}`} className="font-medium hover:underline">{p.clientName}</Link><div className="mt-1 text-xs"><Link href={`/admin/pay/${pm.id}`} className="text-accent hover:underline">{pm.name} · 回款与薪酬 →</Link></div></Td>
              <Td className="text-xs">{p.serviceMonth ? <>第 {p.serviceMonth} 月<div className="text-muted">{p.serviceStart}<br />至 {p.serviceEnd}</div></> : "服务期外"}</Td>
              <Td className="text-right tabular-nums">${p.monthlyFeeUsd.toLocaleString("en-US")}</Td>
              <Td className="text-right font-semibold tabular-nums">{p.custom ? "待约定" : yuan(p.commissionCny)}{p.confirmedCommissionCny === null && !p.custom ? <div className="text-xs font-normal text-amber-700">估算</div> : null}</Td>
              <Td className="text-xs">{p.incomeStatus}<div className="mt-1 text-muted">{p.receivedCny !== null ? `已回款 ${yuan(p.receivedCny)}` : !p.custom && p.serviceMonth ? `$${p.monthlyFeeUsd.toLocaleString("en-US")} × ${pay.fxRate} × 10%` : ""}</div></Td>
              <Td className="text-right tabular-nums">{p.monthlyFullScenarioCny === null ? "—" : yuan(p.monthlyFullScenarioCny)}</Td>
            </tr>))}</tbody>
          </Table>
          <p className="mt-3 text-xs text-muted">月均参考按汇率估算，假设 KPI 达成 ≥130%、交付审核满分且续约 3 个月；奖金按规定另行发放，底薪另计。</p>
        </Card>
        <PayRules fxRate={cfg.fxRate} />

        <Card>
          <CardTitle right={<span className="text-xs text-muted">通过线 {cfg.aiReview.passScore} 分 · 最近 30 条</span>}>AI 审核与自动扣除</CardTitle>
          {reviews.length === 0 ? (
            <Empty>还没有 AI 审核记录。</Empty>
          ) : (
            <Table className="whitespace-nowrap">
              <thead>
                <tr>
                  <Th className="whitespace-nowrap">时间</Th>
                  <Th>项目经理</Th>
                  <Th>材料</Th>
                  <Th className="text-right">分数</Th>
                  <Th>结论</Th>
                  <Th className="text-right">扣该项</Th>
                  <Th>要点</Th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => {
                  const v = VERDICT[r.verdict as keyof typeof VERDICT] ?? VERDICT.ERROR;
                  return (
                    <tr key={r.id} className={r.current ? "" : "opacity-60"}>
                      <Td className="whitespace-nowrap text-xs">{formatBj(r.createdAt)}</Td>
                      <Td>{r.pmName}</Td>
                      <Td>
                        <Link href={`/admin/projects/${r.projectId}`} className="hover:underline">
                          {r.deliverableTitle}
                        </Link>
                        <div className="text-xs text-muted">{r.clientName}</div>
                      </Td>
                      <Td className="text-right tabular-nums">{r.score ?? "—"}</Td>
                      <Td>
                        <Badge tone={v.tone}>{v.label}</Badge>
                        {!r.current ? <div className="mt-1 text-xs text-muted">已重交或被改判</div> : null}
                      </Td>
                      <Td className={`text-right tabular-nums ${r.deductionPct > 0 ? "text-red-600" : ""}`}>{r.deductionPct > 0 ? `${r.deductionPct}%` : "—"}</Td>
                      <Td className="min-w-64 max-w-md whitespace-normal text-xs text-muted">{r.summary}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
