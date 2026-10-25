import { PageHeader } from "@/components/ui";
import { PayView } from "@/components/pay-view";
import { requireSession } from "@/lib/auth";
import { getPmPay } from "@/lib/pay";

export default async function PmPayPage() {
  const session = await requireSession(["PM"]);
  const pay = await getPmPay(session.uid);
  return (
    <>
      <PageHeader title="我的收入" description="每个项目的月提成、回款依据与奖金；按《项目经理薪酬规则》计算" />
      <PayView pay={pay} />
    </>
  );
}
