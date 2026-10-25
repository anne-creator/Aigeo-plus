import { Alert, Badge, Button, Card, CardTitle, Empty, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MEETING_DURATIONS, MEETING_STATE_LABEL, bjTime, meetingEnd, meetingProgress, type MeetingState } from "@/lib/meetings";
import { toBjYmd, WEEKDAY_CN, weekday } from "@/lib/time";
import { cancelMeetingAction, removeInviteeAction, rescheduleMeetingAction, respondMeetingAction } from "./actions";

const STATE_TONE: Record<MeetingState, "green" | "blue" | "red" | "zinc"> = {
  CONFIRMED: "green",
  PENDING: "blue",
  DECLINED: "red",
  CANCELED: "zinc",
};
const INVITE_LABEL: Record<string, { text: string; cls: string }> = {
  ACCEPTED: { text: "已同意", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  DECLINED: { text: "已拒绝", cls: "border-red-200 bg-red-50 text-red-700" },
  PENDING: { text: "未回复", cls: "border-border bg-white text-muted" },
};

function when(m: { startAt: Date; durationMinutes: number }): string {
  const ymd = toBjYmd(m.startAt);
  return `${ymd.slice(5)}（${WEEKDAY_CN[weekday(ymd)]}）${bjTime(m.startAt)}–${bjTime(meetingEnd(m))}`;
}

const include = {
  organizer: { select: { name: true } },
  invites: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
};

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(["PM", "INTERN"]);
  const q = await searchParams;
  const s = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  const canOrganize = session.role === "PM" || session.role === "ADMIN";
  const now = new Date();
  const recent = new Date(now.getTime() - 2 * 3600_000);

  const [mine, upcoming, past] = await Promise.all([
    prisma.meeting.findMany({ where: { organizerId: session.uid, startAt: { gte: recent } }, include, orderBy: { startAt: "asc" } }),
    prisma.meeting.findMany({
      where: { organizerId: { not: session.uid }, startAt: { gte: recent }, invites: { some: { userId: session.uid } } },
      include,
      orderBy: { startAt: "asc" },
    }),
    prisma.meeting.findMany({
      where: { startAt: { lt: recent }, invites: { some: { userId: session.uid } } },
      include,
      orderBy: { startAt: "desc" },
      take: 20,
    }),
  ]);
  const myInvite = (m: (typeof upcoming)[number]) => m.invites.find((i) => i.userId === session.uid);
  const toReply = upcoming.filter((m) => !m.canceledAt && myInvite(m)?.status === "PENDING");
  const attending = upcoming.filter((m) => !toReply.includes(m));

  return (
    <div className="space-y-6">
      <PageHeader
        title="会议"
        description="所有被邀请人都同意后，会议才会进入每个人的日历"
        actions={canOrganize ? <LinkButton href="/meetings/new">发起会议</LinkButton> : null}
      />
      {s("error") ? <Alert tone="red">{s("error")}</Alert> : null}
      {s("ok") ? <Alert tone="green">{s("ok")}</Alert> : null}
      {s("created") ? <Alert tone="green">会议请求已发出。所有人同意后会自动进入每个人的日历，下面可以看同意进度。</Alert> : null}
      {s("responded") === "accepted" ? <Alert tone="green">已同意。所有人都同意后，会议会出现在你的日历里。</Alert> : null}
      {s("responded") === "declined" ? <Alert tone="amber">已拒绝，发起人会看到。</Alert> : null}

      <Card>
        <CardTitle right={<span className="text-xs text-muted">{toReply.length} 个</span>}>等我回复</CardTitle>
        {toReply.length === 0 ? (
          <Empty>没有待回复的会议邀请</Empty>
        ) : (
          <ul className="space-y-3">
            {toReply.map((m) => {
              const p = meetingProgress(m);
              return (
                <li key={m.id} id={`m-${m.id}`} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold">{m.title}</div>
                      <div className="mt-1 text-sm">{when(m)}</div>
                      <div className="mt-1 text-xs text-muted">
                        发起人 {m.organizer.name}
                        {m.location ? ` · ${m.location}` : ""} · 已同意 {p.accepted}/{p.total}
                      </div>
                      {m.note ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{m.note}</p> : null}
                    </div>
                    <form action={respondMeetingAction} className="flex shrink-0 gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <Button type="submit" name="decision" value="ACCEPT">
                        同意
                      </Button>
                      <Button type="submit" name="decision" value="DECLINE" variant="secondary">
                        拒绝
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {canOrganize ? (
        <Card>
          <CardTitle right={<span className="text-xs text-muted">未开始的</span>}>我发起的</CardTitle>
          {mine.length === 0 ? (
            <Empty>还没有发起会议</Empty>
          ) : (
            <ul className="space-y-3">
              {mine.map((m) => {
                const p = meetingProgress(m);
                const others = m.invites.filter((i) => i.userId !== session.uid);
                const pct = p.total ? Math.round((p.accepted / p.total) * 100) : 0;
                return (
                  <li key={m.id} id={`m-${m.id}`} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{m.title}</span>
                      <Badge tone={STATE_TONE[p.state]}>{MEETING_STATE_LABEL[p.state]}</Badge>
                    </div>
                    <div className="mt-1 text-sm">
                      {when(m)}
                      {m.location ? <span className="text-muted"> · {m.location}</span> : null}
                    </div>
                    {p.state !== "CANCELED" ? (
                      <>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div className={`h-full rounded-full ${p.state === "CONFIRMED" ? "bg-emerald-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 text-sm tabular-nums">
                            已同意 <span className="font-semibold">{p.accepted}</span> / {p.total}
                          </span>
                        </div>
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {others.map((i) => {
                            const l = INVITE_LABEL[i.status] ?? INVITE_LABEL.PENDING;
                            return (
                              <li key={i.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${l.cls}`}>
                                <span className="font-medium">{i.user.name}</span>
                                <span>{l.text}</span>
                                {i.status !== "ACCEPTED" && others.length > 1 ? (
                                  <form action={removeInviteeAction} className="inline">
                                    <input type="hidden" name="id" value={m.id} />
                                    <input type="hidden" name="userId" value={i.userId} />
                                    <button type="submit" className="ml-1 text-muted hover:text-red-700" title={`移除 ${i.user.name}`}>
                                      ×
                                    </button>
                                  </form>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                        {p.state === "DECLINED" ? (
                          <p className="mt-2 text-xs text-red-700">有人拒绝：可以移除此人（剩下的人都同意即确认）、改时间让大家重新确认，或取消会议。</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-border pt-3">
                          <details>
                            <summary className="cursor-pointer text-sm text-accent">改时间</summary>
                            <form action={rescheduleMeetingAction} className="mt-2 flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={m.id} />
                              <Input name="date" type="date" required defaultValue={toBjYmd(m.startAt)} className="w-40" aria-label="日期" />
                              <Input name="time" type="time" required step={300} defaultValue={bjTime(m.startAt)} className="w-28" aria-label="开始时间" />
                              <Select name="duration" defaultValue={String(m.durationMinutes)} className="w-28" aria-label="时长">
                                {MEETING_DURATIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d} 分钟
                                  </option>
                                ))}
                              </Select>
                              <Button type="submit" variant="secondary">
                                保存并重新发送
                              </Button>
                            </form>
                          </details>
                          <form action={cancelMeetingAction} className="ml-auto">
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="text-sm text-muted hover:text-red-700 hover:underline">
                              取消会议
                            </button>
                          </form>
                        </div>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <CardTitle>我参加的</CardTitle>
        {attending.length === 0 ? (
          <Empty>暂无</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {attending.map((m) => {
              const p = meetingProgress(m);
              const mineStatus = myInvite(m)?.status ?? "PENDING";
              return (
                <li key={m.id} id={`m-${m.id}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted">
                      {when(m)} · 发起人 {m.organizer.name}
                      {m.location ? ` · ${m.location}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-muted">我{INVITE_LABEL[mineStatus]?.text ?? "未回复"}</span>
                    <Badge tone={STATE_TONE[p.state]}>{MEETING_STATE_LABEL[p.state]}</Badge>
                    {p.state === "PENDING" ? <span className="text-muted">已同意 {p.accepted}/{p.total}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {past.length ? (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">历史会议（{past.length}）</summary>
          <ul className="mt-3 divide-y divide-border text-sm">
            {past.map((m) => {
              const p = meetingProgress(m);
              return (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{m.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {when(m)} · {MEETING_STATE_LABEL[p.state]}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
