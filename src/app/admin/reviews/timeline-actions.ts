"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { approveTimelineRevision } from "@/lib/timeline";
import { failTo, requireAdmin, safeBack, str, withQuery } from "../_lib";

const BACK = "/admin/reviews";

/** 审批项目经理的 timeline 修改申请：通过则按差异更新条目；驳回必须写原因 */
export async function decideTimelineRevision(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const back = safeBack(formData.get("back"), BACK);
  const parsed = z
    .object({
      id: z.string().min(1),
      decision: z.enum(["APPROVE", "REJECT"]),
      note: z.string().trim().max(500, "意见请控制在 500 字以内"),
    })
    .safeParse({ id: str(formData, "id"), decision: str(formData, "decision"), note: str(formData, "note") });
  if (!parsed.success) failTo(back, parsed.error.issues[0]?.message ?? "输入有误");
  const { id, decision, note } = parsed.data;
  const rev = await prisma.timelineRevision.findUnique({ where: { id }, select: { status: true } });
  if (!rev) failTo(back, "申请不存在");
  if (rev.status !== "PENDING") failTo(back, "这份申请已经处理过了");

  if (decision === "REJECT") {
    if (!note) failTo(back, "驳回请写明原因，项目经理会看到");
    await prisma.timelineRevision.update({
      where: { id },
      data: { status: "REJECTED", reviewNote: note, reviewedById: session.uid, reviewedAt: new Date() },
    });
  } else {
    let message = "";
    try {
      await approveTimelineRevision(id, session.uid, note || null);
    } catch (e) {
      message = e instanceof Error ? e.message : "审批失败";
    }
    if (message) failTo(back, message);
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: 1, error: null }));
}
