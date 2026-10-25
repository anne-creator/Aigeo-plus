/**
 * 会议：管理员或项目经理发起，邀请任意内部成员（管理员 / 项目经理 / 负责人）。
 * 所有被邀请人都同意后，会议才进入全部参会人（含发起人）的日历；
 * 有人拒绝时停在“有人拒绝”，发起人可以移除此人、改时间（全员重新确认）或取消。
 */
import type { Meeting, MeetingInvite } from "@prisma/client";
import { prisma } from "./db";
import { BJ_OFFSET_MS, isYmd, toBjYmd, ymdToUtcMidnight } from "./time";

export const MEETING_DURATIONS = [15, 30, 45, 60, 90, 120] as const;
/** 可以被邀请的角色（渠道方不参加内部会议） */
export const INVITABLE_ROLES = ["ADMIN", "PM", "INTERN"] as const;

export type MeetingState = "CANCELED" | "CONFIRMED" | "DECLINED" | "PENDING";

export interface MeetingProgress {
  state: MeetingState;
  /** 不含发起人 */
  total: number;
  accepted: number;
  declined: number;
  pending: number;
}

type WithInvites = Pick<Meeting, "organizerId" | "canceledAt"> & { invites: Array<Pick<MeetingInvite, "userId" | "status">> };

export function meetingProgress(m: WithInvites): MeetingProgress {
  const others = m.invites.filter((i) => i.userId !== m.organizerId);
  const accepted = others.filter((i) => i.status === "ACCEPTED").length;
  const declined = others.filter((i) => i.status === "DECLINED").length;
  const pending = others.length - accepted - declined;
  let state: MeetingState;
  if (m.canceledAt) state = "CANCELED";
  else if (declined > 0) state = "DECLINED";
  else if (others.length > 0 && accepted === others.length) state = "CONFIRMED";
  else state = "PENDING";
  return { state, total: others.length, accepted, declined, pending };
}

export const MEETING_STATE_LABEL: Record<MeetingState, string> = {
  CANCELED: "已取消",
  CONFIRMED: "已确认",
  DECLINED: "有人拒绝",
  PENDING: "等待确认",
};

/** 北京时间 YYYY-MM-DD + HH:mm → Date */
export function bjDateTime(ymd: string, hm: string): Date | null {
  if (!isYmd(ymd) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  return new Date(ymdToUtcMidnight(ymd) - BJ_OFFSET_MS + (h * 60 + m) * 60_000);
}

/** Date → 北京时间 HH:mm */
export function bjTime(d: Date): string {
  return new Date(d.getTime() + BJ_OFFSET_MS).toISOString().slice(11, 16);
}

/** “10-25（周六）14:00–15:00” 这类文字由页面拼；这里给出结束时间 */
export function meetingEnd(m: Pick<Meeting, "startAt" | "durationMinutes">): Date {
  return new Date(m.startAt.getTime() + m.durationMinutes * 60_000);
}

export async function createMeeting(input: {
  organizerId: string;
  title: string;
  startAt: Date;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  inviteeIds: string[];
}): Promise<string> {
  const invitees = Array.from(new Set(input.inviteeIds.filter((id) => id !== input.organizerId)));
  const m = await prisma.meeting.create({
    data: {
      title: input.title,
      startAt: input.startAt,
      durationMinutes: input.durationMinutes,
      location: input.location,
      note: input.note,
      organizerId: input.organizerId,
      invites: {
        create: [
          { userId: input.organizerId, status: "ACCEPTED", respondedAt: new Date() },
          ...invitees.map((userId) => ({ userId })),
        ],
      },
    },
  });
  return m.id;
}

/** 被邀请人回复：接受 / 拒绝（已取消的会议不能回复） */
export async function respondToMeeting(meetingId: string, userId: string, accept: boolean): Promise<void> {
  const inv = await prisma.meetingInvite.findUnique({ where: { meetingId_userId: { meetingId, userId } }, include: { meeting: true } });
  if (!inv) throw new Error("你不在这个会议的邀请名单里");
  if (inv.meeting.canceledAt) throw new Error("会议已取消");
  if (inv.meeting.organizerId === userId) throw new Error("发起人不需要回复");
  await prisma.meetingInvite.update({ where: { id: inv.id }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
}

/** 改时间：所有被邀请人的回复清空，需要重新确认 */
export async function rescheduleMeeting(meetingId: string, startAt: Date, durationMinutes: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.update({ where: { id: meetingId }, data: { startAt, durationMinutes } });
    await tx.meetingInvite.updateMany({ where: { meetingId, userId: { not: m.organizerId } }, data: { status: "PENDING", respondedAt: null } });
  });
}

/**
 * 某人日历里的会议：只放已确认（全员同意、未取消）且本人是参会人或发起人的会议。
 * 范围 [from, to]（北京时间日期）。
 */
export async function confirmedMeetingsFor(userId: string, from: string, to: string) {
  const ms = await prisma.meeting.findMany({
    where: {
      canceledAt: null,
      startAt: { gte: new Date(ymdToUtcMidnight(from) - BJ_OFFSET_MS), lt: new Date(ymdToUtcMidnight(to) + 86_400_000 - BJ_OFFSET_MS) },
      invites: { some: { userId } },
    },
    include: { invites: { select: { userId: true, status: true } } },
    orderBy: { startAt: "asc" },
  });
  return ms.filter((m) => meetingProgress(m).state === "CONFIRMED");
}

/** 等我回复的会议数（未取消、未开始） */
export async function pendingInviteCount(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.meetingInvite.count({
    where: { userId, status: "PENDING", meeting: { canceledAt: null, startAt: { gte: now }, organizerId: { not: userId } } },
  });
}

export function meetingDateLabel(m: Pick<Meeting, "startAt" | "durationMinutes">): { ymd: string; range: string } {
  return { ymd: toBjYmd(m.startAt), range: `${bjTime(m.startAt)}–${bjTime(meetingEnd(m))}` };
}
