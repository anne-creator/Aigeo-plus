import type { PmPay } from "@/lib/pay";
import { Button, Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { saveRenewalTerms, saveServiceReceipt } from "./actions";

export function ReceiptForms({ pay }: { pay: PmPay }) {
  return <Card>
    <CardTitle>录入客户回款</CardTitle>
    <p className="mb-4 text-xs text-muted">填写实际到账人民币。预付多个服务月时平均分摊，尾差计入最后一月；重复录入将更新所选月份的累计回款。回款变更会同步到项目经理收入页面。</p>
    <div className="space-y-3">{pay.projects.map((p) => <details key={p.projectId} className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{p.clientName} · 录入 / 更新回款</summary>
      <form action={saveServiceReceipt} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="projectId" value={p.projectId} />
        <Field label="起始服务月"><Select name="firstMonth" aria-label={`${p.clientName}起始服务月`} defaultValue={p.serviceMonth ?? 1}>{p.ledger.map((m) => <option key={m.month} value={m.month}>第 {m.month} 月 · {m.start} – {m.end}</option>)}</Select></Field>
        <Field label="覆盖月数"><Input name="months" aria-label={`${p.clientName}覆盖月数`} type="number" min={1} max={p.ledger.length} defaultValue={1} required className="w-24" /></Field>
        <Field label="覆盖月份累计回款（人民币）"><Input name="receivedCny" aria-label={`${p.clientName}回款人民币`} type="number" min={0} max={1_000_000_000} step="0.01" placeholder="尚未回款填 0" required className="w-48" /></Field>
        <Field label="回款依据 / 备注"><Input name="note" aria-label={`${p.clientName}回款备注`} maxLength={1000} placeholder="到账日期、银行凭证编号等" /></Field>
        <Button type="submit">保存回款</Button>
      </form>
    </details>)}</div>
  </Card>;
}

export function RenewalForms({ pay }: { pay: PmPay }) {
  if (!pay.renewals.length) return null;
  return <Card>
    <CardTitle>核实续约奖金依据</CardTitle>
    <p className="mb-4 text-xs text-muted">此处登记原合同带来的续约奖；新一期交付与月提成在新一期项目档案中维护。服务结束后填写实际服务且已回款的月数和人民币金额；未核实前仅显示估算，不能标记发放。</p>
    <div className="space-y-3">{pay.renewals.map((r) => <details key={r.projectId} className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{r.clientName} · {r.status}</summary>
      {r.paidAt ? <p className="mt-3 text-xs text-muted">已发放。如需修改依据，请先撤销发放。</p> : <form action={saveRenewalTerms} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="projectId" value={r.projectId} />
        <Field label="续约签约日"><Input name="renewalSignedDate" aria-label="续约签约日" type="date" defaultValue={r.signedDate ?? ""} required /></Field>
        <Field label="续约服务开始日"><Input name="renewalStartDate" aria-label="续约服务开始日" type="date" defaultValue={r.periodStart ?? ""} required /></Field>
        <Field label="实际服务并回款月数"><Input name="renewalServedPaidMonths" aria-label="实际服务并回款月数" type="number" min={0} max={r.months} step={1} defaultValue={r.servedPaidMonths ?? ""} placeholder="未结束可留空" className="w-36" /></Field>
        <Field label="这些月份的实际回款（人民币）"><Input name="renewalReceivedCny" aria-label="续约实际回款人民币" type="number" min={0} step="0.01" defaultValue={r.receivedCny ?? ""} placeholder="未核实可留空" className="w-48" /></Field>
        <Button type="submit">保存续约依据</Button>
      </form>}
    </details>)}</div>
  </Card>;
}
