import type { Session } from "./auth";
import { prisma } from "./db";
import { getRulesConfig } from "./settings";
import { deliverableStatus, timelineItemStatus, DELIVERABLE_META, type DeliverableCode } from "./rules";
import { addDays, toBjYmd } from "./time";
import { weeklyWork, type WeekWork } from "./tasks";
import { bjTime, confirmedMeetingsFor, meetingEnd, pendingInviteCount } from "./meetings";

/** 日历里的一条事件（系统节点 / timeline 条目 / 实习生任务） */
export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD（北京时间） */
  date: string;
  title: string;
  kind: "DELIVERABLE" | "TIMELINE" | "INTERN_TASK" | "MEETING";
  /** 会议：北京时间 “14:00–15:00” */
  time?: string;
  projectId: string | null;
  projectName: string | null;
  /** 负责人姓名（管理员视图用） */
  ownerName: string | null;
  done: boolean;
  /** 已过截止且未完成 */
  overdue: boolean;
  /** timeline 条目：已过截止但在宽限期内 */
  grace: boolean;
  /** 点击去处 */
  href: string;
  /** 可以在 checklist 里直接勾选（timeline 条目、实习生任务） */
  toggleable: boolean;
}

export interface CalendarData {
  todayYmd: string;
  events: CalendarEvent[];
  /** 仅负责人：本周工作时长（已完成任务的预计用时之和） */
  weekWork?: WeekWork;
  /** 等我回复的会议邀请数 */
  pendingInvites?: number;
}

const ACTIVE = ["ACTIVE", "PAUSED"];

/**
 * 当前用户的日历事件：
 * - PM：名下进行中项目的全部系统节点 + timeline 条目
 * - ADMIN：全部进行中项目（带项目经理姓名）
 * - INTERN：分配给自己的任务
 * 范围：今天前 60 天到后 180 天。
 */
export async function getCalendarData(session: Session, now: Date = new Date()): Promise<CalendarData> {
  const todayYmd = toBjYmd(now);
  const from = addDays(todayYmd, -60);
  const to = addDays(todayYmd, 180);
  const events: CalendarEvent[] = [];

  if (session.role === "INTERN") {
    const tasks = await prisma.internTask.findMany({
      where: { assigneeId: session.uid },
      include: { project: { select: { id: true, clientName: true } } },
      orderBy: { dueAt: "asc" },
    });
    for (const t of tasks) {
      const date = t.dueAt ? toBjYmd(t.dueAt) : todayYmd;
      if (date < from || date > to) continue;
      events.push({
        id: t.id,
        date,
        title: t.title,
        kind: "INTERN_TASK",
        projectId: t.project?.id ?? null,
        projectName: t.project?.clientName ?? null,
        ownerName: null,
        done: t.status === "DONE",
        overdue: t.status !== "DONE" && date < todayYmd,
        grace: false,
        href: `/intern#task-${t.id}`,
        toggleable: true,
      });
    }
    events.push(...(await meetingEvents(session.uid, from, to, now)));
    events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { todayYmd, events, weekWork: await weeklyWork(session.uid, now), pendingInvites: await pendingInviteCount(session.uid, now) };
  }

  const config = await getRulesConfig();
  const where = session.role === "ADMIN" ? { status: { in: ACTIVE } } : { status: { in: ACTIVE }, pmId: session.uid };
  const projects = await prisma.project.findMany({
    where,
    include: {
      pm: { select: { name: true } },
      deliverables: { orderBy: { dueAt: "asc" } },
      timelineItems: { orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] },
    },
  });
  const base = session.role === "ADMIN" ? "/admin/projects" : "/pm/projects";
  for (const p of projects) {
    for (const d of p.deliverables) {
      const date = toBjYmd(d.dueAt);
      if (date < from || date > to) continue;
      const status = deliverableStatus(d, now);
      events.push({
        id: d.id,
        date,
        title: DELIVERABLE_META[d.code as DeliverableCode]?.name ?? d.title,
        kind: "DELIVERABLE",
        projectId: p.id,
        projectName: p.clientName,
        ownerName: p.pm.name,
        done: Boolean(d.firstSubmittedAt),
        overdue: status === "OVERDUE",
        grace: false,
        href:
          session.role === "ADMIN"
            ? `${base}/${p.id}#d-${d.id}`
            : d.kind === "TIMELINE"
              ? `${base}/${p.id}/timeline`
              : `${base}/${p.id}/deliverables/${d.id}`,
        toggleable: false,
      });
    }
    for (const t of p.timelineItems) {
      if (t.dueDate < from || t.dueDate > to) continue;
      const status = timelineItemStatus(t, config.timeline.graceDays, now);
      events.push({
        id: t.id,
        date: t.dueDate,
        title: t.title,
        kind: "TIMELINE",
        projectId: p.id,
        projectName: p.clientName,
        ownerName: p.pm.name,
        done: status === "DONE",
        overdue: status === "OVERDUE",
        grace: status === "GRACE",
        href: `${base}/${p.id}/timeline`,
        toggleable: true,
      });
    }
  }
  // 管理员的日历只放全公司节点；会议按个人（参会的才放）
  events.push(...(await meetingEvents(session.uid, from, to, now)));
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === b.kind ? 0 : a.kind === "MEETING" ? -1 : b.kind === "MEETING" ? 1 : a.kind === "DELIVERABLE" ? -1 : 1));
  return { todayYmd, events, pendingInvites: await pendingInviteCount(session.uid, now) };
}

/** 已确认（全员同意）的会议进入参会人日历；结束后算“已完成” */
async function meetingEvents(userId: string, from: string, to: string, now: Date): Promise<CalendarEvent[]> {
  const ms = await confirmedMeetingsFor(userId, from, to);
  return ms.map((m) => ({
    id: m.id,
    date: toBjYmd(m.startAt),
    title: m.title,
    kind: "MEETING" as const,
    time: `${bjTime(m.startAt)}–${bjTime(meetingEnd(m))}`,
    projectId: null,
    projectName: m.location,
    ownerName: null,
    done: meetingEnd(m).getTime() < now.getTime(),
    overdue: false,
    grace: false,
    href: `/meetings#m-${m.id}`,
    toggleable: false,
  }));
}
