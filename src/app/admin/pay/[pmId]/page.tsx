import { notFound } from "next/navigation";
import { Alert, Button, Card, CardTitle, Field, Input, LinkButton, PageHeader } from "@/components/ui";
import { PayView, yuan } from "@/components/pay-view";
import { prisma } from "@/lib/db";
import { baseSalaryByHours, getPmPay } from "@/lib/pay";
import { toBjYmd } from "@/lib/time";
import { one } from "../../_lib";
import { saveMonthlyHours, setRenewalPaid, saveDepartureDate } from "../actions";
import { ReceiptForms, RenewalForms } from "../receipt-forms";

export default async function AdminPmPay({
  params,
  searchParams,
}: {
  params: Promise<{ pmId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { pmId } = await params;
  const sp = await searchParams;
  const pm = await prisma.user.findUnique({ where: { id: pmId }, select: { id: true, name: true, role: true, departedOn: true } });
  if (!pm || pm.role !== "PM") notFound();
  const pay = await getPmPay(pm.id);
  const history = await prisma.monthlyHours.findMany({ where: { userId: pm.id }, orderBy: { month: "desc" }, take: 6 });
  const month = toBjYmd(new Date()).slice(0, 7);
  const error = one(sp.error);

  return (
    <>
      <PageHeader
        title={`${pm.name} · 薪酬`}
        description="按薪酬规则核算：逐项目月提成、实际回款、个人底薪与奖金"
        actions={
          <LinkButton href="/admin/pay" variant="secondary">
            返回薪酬平台
          </LinkButton>
        }
      />
      <div className="space-y-6">
        {error ? <Alert tone="red">{error}</Alert> : null}
        {one(sp.saved) ? <Alert tone="green">已保存</Alert> : null}
        <PayView pay={pay} linkDeliverables={false} />
        <ReceiptForms pay={pay} />
        <RenewalForms pay={pay} />
        <details className="rounded-xl border border-border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">离职结算{pm.departedOn ? ` · ${pm.departedOn}` : "（在职无需填写）"}</summary>
          <p className="mt-3 text-xs text-muted">离职前已发生的月提成保留，未结算的 KPI 奖与续约奖停发。账号临时停用不等于离职。</p>
          <form action={saveDepartureDate} className="mt-3 flex items-end gap-3">
            <input type="hidden" name="userId" value={pm.id} />
            <Field label="实际离职日期（清空可撤销）"><Input type="date" name="departedOn" aria-label="实际离职日期" defaultValue={pm.departedOn ?? ""} /></Field>
            <Button type="submit" variant="secondary">保存离职日期</Button>
          </form>
        </details>

        <Card>
          <CardTitle>录入日均有效工作时间</CardTitle>
          <p className="mb-3 text-xs text-muted">以内部管理平台工时记录为依据，按当月工作日取平均。未录入时底薪显示待确认。</p>
          <form action={saveMonthlyHours} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={pm.id} />
            <Field label="月份">
              <Input type="month" name="month" defaultValue={month} required className="w-40" />
            </Field>
            <Field label="日均小时">
              <Input type="number" name="avgDailyHours" min={0} max={24} step={0.1} defaultValue={pay.base.avgDailyHours ?? ""} required className="w-28" />
            </Field>
            <Button type="submit">保存</Button>
          </form>
          {history.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              已录入：
              {history.map((h) => `${h.month} ${h.avgDailyHours}h（${yuan(baseSalaryByHours(h.avgDailyHours).salary)}）`).join(" · ")}
            </p>
          ) : null}
        </Card>

        {pay.renewals.some((r) => r.payable || r.paidAt) ? (
          <Card>
            <CardTitle>续约奖发放</CardTitle>
            <ul className="divide-y divide-border text-sm">
              {pay.renewals
                .filter((r) => r.payable || r.paidAt)
                .map((r) => (
                  <li key={r.projectId} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {r.clientName} · 续约 {r.months} 个月 · {yuan(r.bonusCny)}
                    </span>
                    <form action={setRenewalPaid}>
                      <input type="hidden" name="projectId" value={r.projectId} />
                      <input type="hidden" name="pmId" value={pm.id} />
                      <input type="hidden" name="paid" value={r.paidAt ? "0" : "1"} />
                      <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                        {r.paidAt ? "撤销已发放" : "标记已发放"}
                      </Button>
                    </form>
                  </li>
                ))}
            </ul>
          </Card>
        ) : null}

      </div>
    </>
  );
}
