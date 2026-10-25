import { prisma } from "./db";
import { commissionFromReceipt } from "./compensation";
import { round2 } from "./rules";

/** 先按合同估算；季度所有服务月确认回款后，以实际月提成平均值作为满奖基数。 */
export async function quarterReceiptBasis(projectId: string, quarter: number, contractMonths: number) {
  const first = (quarter - 1) * 3 + 1;
  const last = Math.min(quarter * 3, contractMonths);
  const months = Math.max(0, last - first + 1);
  const rows = await prisma.serviceReceipt.findMany({ where: { projectId, serviceMonth: { gte: first, lte: last } } });
  const complete = months > 0 && rows.length === months && rows.every((r) => r.receivedCny > 0);
  return { complete, monthlyCommissionCny: complete ? round2(rows.reduce((sum, r) => sum + commissionFromReceipt(r.receivedCny), 0) / months) : null };
}
