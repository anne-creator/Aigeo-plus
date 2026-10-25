"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Role } from "@/lib/auth";
import type { CalendarData, CalendarEvent } from "@/lib/calendar";
import { formatMinutes } from "@/lib/minutes";
import type { WeekWork } from "@/lib/tasks";
import { weekday } from "@/lib/time";
import { Checklist } from "./checklist";
import { cx, dayLabel, eventTone, KIND_LABEL, monthCells, monthLabel, monthOf, shiftMonth, statusOf, type Tone } from "./utils";

const WEEK_HEAD = ["一", "二", "三", "四", "五", "六", "日"];
const TONE_ORDER: Tone[] = ["red", "blue", "green", "grey", "amber"];

const DOT: Record<Tone, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  grey: "bg-zinc-300",
  amber: "bg-amber-500",
};
const TEXT: Record<Tone, string> = {
  red: "text-red-600",
  blue: "text-blue-600",
  green: "text-emerald-600",
  grey: "text-muted",
  amber: "text-amber-600",
};

function NavButton({ onClick, children, label }: { onClick: () => void; children: string; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-md px-2 py-0.5 text-sm text-muted hover:bg-zinc-100 hover:text-foreground">
      {children}
    </button>
  );
}

function DayCell({
  ymd,
  events,
  today,
  selected,
  onSelect,
}: {
  ymd: string;
  events: CalendarEvent[];
  today: string;
  selected: boolean;
  onSelect: (d: string) => void;
}) {
  const tones = events.map((e) => eventTone(e, today)).sort((a, b) => TONE_ORDER.indexOf(a) - TONE_ORDER.indexOf(b));
  const isToday = ymd === today;
  return (
    <button
      type="button"
      onClick={() => onSelect(ymd)}
      aria-label={dayLabel(ymd)}
      aria-pressed={selected}
      className={cx(
        "flex h-10 flex-col items-center justify-center rounded-md text-xs",
        selected ? "bg-zinc-900 text-white" : "hover:bg-zinc-100",
        isToday && !selected && "font-semibold text-accent ring-1 ring-accent",
      )}
    >
      <span>{Number(ymd.slice(8))}</span>
      <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
        {tones.length > 3 ? (
          <span className={cx("text-[9px] leading-none", selected ? "text-white/80" : TEXT[tones[0]])}>{tones.length}</span>
        ) : (
          tones.map((t, i) => <span key={i} className={cx("h-1.5 w-1.5 rounded-full", DOT[t])} />)
        )}
      </span>
    </button>
  );
}

function EventRow({ e, role, today }: { e: CalendarEvent; role: Role; today: string }) {
  const status = statusOf(e, today);
  const sub = [e.projectName, role === "ADMIN" ? e.ownerName : null].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={e.href} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-50">
        <span className="mt-0.5 shrink-0 rounded bg-zinc-100 px-1 text-[10px] leading-4 text-muted">{KIND_LABEL[e.kind]}</span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate leading-5", e.done && "text-muted line-through")}>{e.title}</span>
          {sub ? <span className="block truncate text-[11px] text-muted">{sub}</span> : null}
        </span>
        <span className={cx("mt-0.5 shrink-0 text-[11px]", TEXT[status.tone])}>{status.text}</span>
      </Link>
    </li>
  );
}

/** 右侧个人日历：月视图 + 选中日的事项 + 当日 checklist */
export function CalendarSidebar({ data, role }: { data: CalendarData; role: Role }) {
  const { todayYmd, events } = data;
  const [ym, setYm] = useState(() => monthOf(todayYmd));
  const [selected, setSelected] = useState(todayYmd);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.date);
      if (list) list.push(e);
      else m.set(e.date, [e]);
    }
    return m;
  }, [events]);
  const cells = useMemo(() => monthCells(ym), [ym]);
  const dayEvents = byDate.get(selected) ?? [];

  function goToday() {
    setYm(monthOf(todayYmd));
    setSelected(todayYmd);
  }

  return (
    <div className="space-y-4">
      {data.pendingInvites ? (
        <Link
          href="/meetings"
          className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <span>
            <span className="font-semibold">{data.pendingInvites}</span> 个会议邀请等你回复
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
      {data.weekWork ? <WeekWorkCard work={data.weekWork} todayYmd={todayYmd} /> : null}
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm">
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <NavButton onClick={() => setYm(shiftMonth(ym, -1))} label="上个月">
              ‹
            </NavButton>
            <span className="min-w-20 text-center font-medium">{monthLabel(ym)}</span>
            <NavButton onClick={() => setYm(shiftMonth(ym, 1))} label="下个月">
              ›
            </NavButton>
          </div>
          <button type="button" onClick={goToday} className="rounded-md px-2 py-0.5 text-xs text-accent hover:bg-blue-50">
            今天
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-muted">
          {WEEK_HEAD.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) =>
            d ? (
              <DayCell key={d} ymd={d} events={byDate.get(d) ?? []} today={todayYmd} selected={d === selected} onSelect={setSelected} />
            ) : (
              <span key={`blank-${i}`} />
            ),
          )}
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="text-xs font-medium text-muted">
          {dayLabel(selected)}
          {selected === todayYmd ? " · 今天" : ""}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="mt-2 text-xs text-muted">这天没有安排</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {dayEvents.map((e) => (
              <EventRow key={`${e.kind}-${e.id}`} e={e} role={role} today={todayYmd} />
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-border pt-4">
        <Checklist events={events} today={todayYmd} role={role} />
      </div>
    </div>
    </div>
  );
}


/** 负责人的本周工作时长：已完成任务的预计用时之和，每完成一个任务就增加 */
function WeekWorkCard({ work, todayYmd }: { work: WeekWork; todayYmd: string }) {
  const max = Math.max(60, ...work.byDay);
  const todayIdx = (weekday(todayYmd) + 6) % 7;
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm" aria-label="本周工作时长">
      <div className="text-xs text-muted">本周工作时长</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{formatMinutes(work.totalMinutes)}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        已完成 {work.doneCount} 项 · {work.weekStart.slice(5)} 至 {work.weekEnd.slice(5)}
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
        {work.byDay.map((m, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end rounded bg-zinc-100">
              <div
                className={`w-full rounded ${i === todayIdx ? "bg-accent" : "bg-blue-300"}`}
                style={{ height: m ? `${Math.max(8, Math.round((m / max) * 100))}%` : 0 }}
                title={`周${WEEK_HEAD[i]} ${formatMinutes(m)}`}
              />
            </div>
            <span className={`text-[10px] ${i === todayIdx ? "font-semibold text-foreground" : "text-muted"}`}>{WEEK_HEAD[i]}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">按项目经理录入的预计用时累计，任务完成时计入。</p>
    </section>
  );
}
