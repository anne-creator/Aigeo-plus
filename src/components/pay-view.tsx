import Link from "next/link";
import type { ReactNode } from "react";
import type { DeductionKind, PmPay } from "@/lib/pay";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";

/** 到分，省略无意义的末尾零。 */
export function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

const KIND: Record<DeductionKind, { label: string; tone: "red" | "amber" | "blue" }> = {
  AI: { label: "AI 审核", tone: "red" },
  REVIEW: { label: "人工审核", tone: "red" },
  LATE: { label: "晚交", tone: "amber" },
  TIMELINE: { label: "timeline", tone: "amber" },
};

function Big({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-700" : ""}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

/** 保住的 / 被扣的 横条 */
export function KeptBar({ kept, lost }: { kept: number; lost: number }) {
  const total = kept + lost;
  const k = total > 0 ? (kept / total) * 100 : 100;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
      <div className="bg-emerald-500" style={{ width: `${k}%` }} />
      <div className="bg-red-400" style={{ width: `${100 - k}%` }} />
    </div>
  );
}

/** 两个角色共用同一份计算结果与收入口径。 */
export function PayView({ pay, linkDeliverables = true }: { pay: PmPay; linkDeliverables?: boolean }) {
  const deductions = pay.projects.flatMap((p) => p.deductions.map((d) => ({ ...d, client: p.clientName })));
  const pendingBonus = pay.projects.filter((p) => p.bonusPending).length;
  const itemLink = (href: string, text: ReactNode) => linkDeliverables ? <Link href={href as never} className="hover:underline">{text}</Link> : text;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <Big label={`当前月收入参考 · ${pay.month}`} value={yuan(pay.monthlyFixed)} sub={<>底薪 {pay.base.source === "PENDING" ? "待录工时，暂未计入" : yuan(pay.base.salary)} + 月提成 {yuan(pay.commissionTotal)}<br />{pay.pendingReceiptCount} 个项目待确认回款{pay.customProjectCount ? `；${pay.customProjectCount} 个大额项目另议，未计入` : ""}</>} />
        <Big label="已确认回款对应月提成" value={yuan(pay.confirmedCommissionTotal)} sub="按当前服务月实际人民币回款 × 10%" tone="green" />
        <Big label="各项目当季 KPI 奖预计" value={yuan(pay.bonusProjected)} sub={pendingBonus ? `${pendingBonus} 个项目金额待定，未计入；奖金单独结算` : "季度审核与回款确认后，下个发薪日发放"} />
        <Big label="待结续约奖参考" value={yuan(pay.renewalTotal)} sub="续约期结束并核实回款后发放；含待确认估算" />
      </div>

      <Card>
        <CardTitle right={<Badge tone="blue">月提成固定 10%</Badge>}>每个项目，每月能获得多少</CardTitle>
        <p className="mb-4 text-xs text-muted">按当前服务月列示。沿用项目排期的 30 天服务月，日期见各项目；未确认回款按汇率 {pay.fxRate} 估算。底薪按个人工时计算，单独列示。</p>
        {pay.projects.length === 0 ? <Empty>还没有负责的项目。</Empty> : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {pay.projects.map((p) => (
              <div key={p.projectId} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={(linkDeliverables ? `/pm/projects/${p.projectId}` : `/admin/projects/${p.projectId}`) as never} className="font-semibold hover:text-accent">{p.clientName}</Link>
                  <Badge tone={p.custom || p.confirmedCommissionCny === null ? "amber" : "zinc"}>{p.incomeStatus}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">月服务费 ${p.monthlyFeeUsd.toLocaleString("en-US")}{p.serviceMonth ? ` · 第 ${p.serviceMonth} 服务月：${p.serviceStart} – ${p.serviceEnd}` : ""}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted">本服务月提成{p.confirmedCommissionCny === null && !p.custom ? "（估算）" : ""}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{p.custom ? "待约定" : yuan(p.commissionCny)}<span className="ml-1 text-xs font-normal text-muted">/月</span></div>
                    <div className="mt-1 text-xs text-muted">{p.custom ? "超过 $5,000/月，按项目协议分配" : p.receivedCny !== null ? `本月已回款 ${yuan(p.receivedCny)} × 10%${p.commissionCny === 0 && p.receivedCny > 0 ? "，因停发不计入" : ""}` : p.serviceMonth && p.estimatedCommissionCny > 0 ? `$${p.monthlyFeeUsd.toLocaleString("en-US")} × ${pay.fxRate} × 10%` : "本期无新增月提成"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">第 {p.quarter} 季 KPI 奖预计</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">{p.bonusPending ? "待确认" : yuan(p.projectedBonusCny)}</div>
                    <div className="mt-1 text-xs text-muted">{p.bonusStatus}</div>
                    {!p.custom ? <div className="mt-1 text-xs text-muted">满奖基数 {yuan(p.fullBonusCny)} · 交付得分 {p.deliveryScorePct.toFixed(0)}%{!p.tierAssumed ? ` · 效果档位 ${p.tierPct}%` : ""}</div> : null}
                  </div>
                </div>
                {p.monthlyFullScenarioCny !== null ? (
                  <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    {p.monthlyWithKpiCny !== null ? <div>按当前 KPI 奖摊到每月：<strong>{yuan(p.monthlyWithKpiCny)}</strong>（未含续约奖）</div> : null}
                    <div>满 KPI 奖 + 续约 3 个月时，月均约 <strong>{yuan(p.monthlyFullScenarioCny)}</strong></div>
                    <div className="mt-1 text-blue-700">情景参考，按合同及汇率估算；季度奖和续约奖按规定单独发放。</div>
                  </div>
                ) : null}
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer font-medium text-accent">查看每个服务月的回款与提成</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead><tr className="border-b border-border text-muted"><th className="py-2">服务月 / 日期</th><th className="pl-3 text-right">回款人民币</th><th className="pl-3 text-right">月提成</th></tr></thead>
                      <tbody>{p.ledger.map((m) => (
                        <tr key={m.month} className={`border-b border-border/60 ${m.current ? "bg-blue-50" : ""}`}>
                          <td className="py-2">第 {m.month} 月{m.current ? " · 当前" : ""}<div className="text-muted">{m.start} – {m.end}</div>{m.note ? <div className="text-muted">{m.note}</div> : null}</td>
                          <td className="whitespace-nowrap pl-3 text-right tabular-nums">{m.receivedCny === null ? "待确认" : yuan(m.receivedCny)}</td>
                          <td className="whitespace-nowrap pl-3 text-right tabular-nums">{!m.eligible ? "已停发" : p.custom ? "另行约定" : m.commissionCny === null ? `${yuan(m.estimatedCny ?? 0)} 估算` : yuan(m.commissionCny)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-muted">预付多月仍分配到各服务月，按月随工资发放。管理员录入的金额为该服务月累计回款。</p>
                </details>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>个人底薪</CardTitle>
        <p className="text-lg font-semibold">{pay.base.source === "PENDING" ? "待录工时" : yuan(pay.base.salary)}<span className="ml-2 text-sm font-normal text-muted">{pay.base.label}</span></p>
        <p className="mt-2 text-sm text-muted">日均不足 4 小时：¥0；4–6 小时：¥4,000；6–8 小时：¥8,000；8 小时及以上：¥12,000。分界点归高一档。</p>
        <p className="mt-1 text-xs text-muted">{pay.base.source === "HOURS" ? `本月日均 ${pay.base.avgDailyHours} 小时，管理员按当月工作日工时记录录入。` : "需依据内部平台工时记录，按当月工作日取平均；项目数仅作参考，不能代替工时确认底薪。"}</p>
      </Card>

      {pay.renewals.length ? <Card>
        <CardTitle>续约奖 · 每续约 3 个月奖 1 个月提成</CardTitle>
        <ul className="divide-y divide-border text-sm">{pay.renewals.map((r) => (
          <li key={r.projectId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><div className="font-medium">{r.clientName} · 续约 {r.months} 个月</div><div className="mt-1 text-xs text-muted">{r.periodStart && r.periodEnd ? `续约期 ${r.periodStart} – ${r.periodEnd}` : "续约服务期待录入"} · {r.status}</div>{r.servedPaidMonths !== null ? <div className="mt-1 text-xs text-muted">实际服务并回款 {r.servedPaidMonths} 月 · 回款 {yuan(r.receivedCny ?? 0)}</div> : null}</div>
            <div className="text-right"><div className="font-semibold">{yuan(r.bonusCny)}{r.estimated ? <span className="ml-1 text-xs font-normal text-muted">估算</span> : null}</div><div className="text-xs text-muted">{r.paidAt ? "已发放，不再计入待结" : "单独结算，未计入月收入"}</div></div>
          </li>
        ))}</ul>
      </Card> : null}

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-sm font-medium">查看交付扣分对季度奖的影响 · 当前少拿 {yuan(pay.bonusLost)}</summary>
        {deductions.length === 0 ? <p className="mt-3 text-sm text-muted">目前没有可计算的扣款金额；效果尚未确认时，不能据此认定拿满奖。</p> : <ul className="mt-2 divide-y divide-border">{deductions.map((d, i) => <li key={i} className="flex items-start justify-between gap-3 py-3"><div><div className="flex items-center gap-2 text-sm"><Badge tone={KIND[d.kind].tone}>{KIND[d.kind].label}</Badge>{itemLink(d.href, d.title)}</div><div className="mt-1 text-xs text-muted">{d.client} · {d.reason}</div></div><span className="text-sm font-semibold text-red-600">−{yuan(d.lostCny)}</span></li>)}</ul>}
      </details>
      <PayRules fxRate={pay.fxRate} />
    </div>
  );
}

export function PayRules({ fxRate }: { fxRate: number }) {
  return <Card>
    <CardTitle>薪酬规则与发放时间</CardTitle>
    <div className="mb-3 grid gap-3 sm:grid-cols-2">
      {[{ fee: 2000, commission: 1360, monthly: 2266.67 }, { fee: 3300, commission: 2244, monthly: 3740 }].map((x) => <div key={x.fee} className="rounded-lg bg-zinc-50 p-3 text-sm"><strong>${x.fee.toLocaleString("en-US")}/月项目 → 月提成 {yuan(x.commission)}</strong><div className="mt-1 text-xs text-muted">规则原文示例，汇率 6.8；满 KPI 奖并续约 3 个月时，月均约 {yuan(x.monthly)}，底薪另计。</div></div>)}
    </div>
    <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
      <li>月提成固定为实际人民币服务费回款的 10%；未录回款按汇率 {fxRate} 估算。底薪和月提成每月随工资发放。</li>
      <li>效果达成率 = 实际 ShowUp 率 ÷ 合同目标。≥130% 发满奖；100%–不足130% 发 60%；不足100% 不发。满奖为 1 个月提成；每月回款不同时，暂取本季度实际月提成的平均值，再乘效果档位和交付得分，审核完成后于下个发薪日发放。</li>
      <li>续约须在上期结束后 90 天内签约。每续约 3 个月奖 1 个月提成；提前终止按实际服务并回款月数核算，续约期结束后的下个发薪日发放。</li>
      <li>暂停或终止合作：下一个服务月起停发提成，当季 KPI 奖停发。项目经理离职：已发生月提成照常结算，未结 KPI 和续约奖停发。</li>
      <li>月服务费超过 $5,000 的大额项目，需事先约定多项目经理的分配与 KPI；金额待约定，不自动计入标准提成总额。</li>
      <li>收入按到手口径列示；情景月均仅用于比较，不代表当月发薪金额。</li>
    </ul>
  </Card>;
}
