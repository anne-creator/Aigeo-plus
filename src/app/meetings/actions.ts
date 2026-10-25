"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INVITABLE_ROLES, MEETING_DURATIONS, bjDateTime, createMeeting, rescheduleMeeting, respondToMeeting } from "@/lib/meetings";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

function go(path: string, q: Record<string, string> = {}): never {
  const qs = new URLSearchParams(q).toString();
  revalidatePath("/", "layout");
  redirect(`${path}${qs ? `?${qs}` : ""}`);
}

const durationSchema = z.coerce
  .number()
  .int()
  .refine((n) => (MEETING_DURATIONS as readonly number[]).includes(n), "请选择会议时长");

/** 发起会议：管理员或项目经理 */
export async function createMeetingAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM"]);
  const parsed = z
    .object({
      title: z.string().min(1, "请写会议目的").max(200, "会议目的请控制在 200 字以内"),
      date: z.string().min(1, "请选择日期"),
      time: z.string().min(1, "请选择开始时间"),
      duration: durationSchema,
      location: z.string().max(300, "地点或链接太长"),
      note: z.string().max(2000, "备注太长"),
      invitees: z.array(z.string().min(1)).min(1, "请至少选择一位参会人"),
    })
    .safeParse({
      title: str(formData, "title"),
      date: str(formData, "date"),
      time: str(formData, "time"),
      duration: str(formData, "duration"),
      location: str(formData, "location"),
      note: str(formData, "note"),
      invitees: formData.getAll("invitees").filter((v): v is string => typeof v === "string"),
    });
  if (!parsed.success) go("/meetings/new", { error: parsed.error.issues[0]?.message ?? "输入有误" });
  const v = parsed.data;
  const startAt = bjDateTime(v.date, v.time);
  if (!startAt) go("/meetings/new", { error: "日期或时间格式不对" });
  if (startAt.getTime() < Date.now() - 5 * 60_000) go("/meetings/new", { error: "会议时间不能早于现在" });

  const users = await prisma.user.findMany({
    where: { id: { in: v.invitees }, active: true, role: { in: [...INVITABLE_ROLES] } },
    select: { id: true },
  });
  if (users.length === 0) go("/meetings/new", { error: "所选参会人无效" });
  const id = await createMeeting({
    organizerId: session.uid,
    title: v.title,
    startAt,
    durationMinutes: v.duration,
    location: v.location || null,
    note: v.note || null,
    inviteeIds: users.map((u) => u.id),
  });
  go("/meetings", { created: id });
}

/** 被邀请人回复 */
export async function respondMeetingAction(formData: FormData): Promise<void> {
  const session = await requireSession(["PM", "INTERN"]);
  const id = str(formData, "id");
  const accept = str(formData, "decision") === "ACCEPT";
  let message = "";
  try {
    await respondToMeeting(id, session.uid, accept);
  } catch (e) {
    message = e instanceof Error ? e.message : "操作失败";
  }
  if (message) go("/meetings", { error: message });
  go("/meetings", { responded: accept ? "accepted" : "declined" });
}

/** 只有发起人（或管理员）能管理会议 */
async function loadOwned(id: string) {
  const session = await requireSession(["PM"]);
  const m = await prisma.meeting.findUnique({ where: { id } });
  if (!m || (m.organizerId !== session.uid && session.role !== "ADMIN")) go("/meetings", { error: "会议不存在或无权操作" });
  return m;
}

export async function cancelMeetingAction(formData: FormData): Promise<void> {
  const m = await loadOwned(str(formData, "id"));
  await prisma.meeting.update({ where: { id: m.id }, data: { canceledAt: new Date() } });
  go("/meetings", { ok: "会议已取消，参会人会看到“已取消”" });
}

/** 改时间：所有人重新确认 */
export async function rescheduleMeetingAction(formData: FormData): Promise<void> {
  const m = await loadOwned(str(formData, "id"));
  const duration = durationSchema.safeParse(str(formData, "duration"));
  const startAt = bjDateTime(str(formData, "date"), str(formData, "time"));
  if (!startAt || !duration.success) go("/meetings", { error: "请填写新的日期、时间和时长" });
  if (startAt.getTime() < Date.now() - 5 * 60_000) go("/meetings", { error: "会议时间不能早于现在" });
  await rescheduleMeeting(m.id, startAt, duration.data);
  go("/meetings", { ok: "已改时间，已重新发给所有参会人确认" });
}

/** 移除一位参会人（例如拒绝的人），剩下的人都同意就会自动确认 */
export async function removeInviteeAction(formData: FormData): Promise<void> {
  const m = await loadOwned(str(formData, "id"));
  const userId = str(formData, "userId");
  if (userId === m.organizerId) go("/meetings", { error: "不能移除发起人" });
  const left = await prisma.meetingInvite.count({ where: { meetingId: m.id, userId: { not: m.organizerId } } });
  if (left <= 1) go("/meetings", { error: "至少保留一位参会人；不需要开了可以直接取消会议" });
  await prisma.meetingInvite.deleteMany({ where: { meetingId: m.id, userId } });
  go("/meetings", { ok: "已移除" });
}
