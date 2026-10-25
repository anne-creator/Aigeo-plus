import Link from "next/link";
import type { Role } from "@/lib/auth";
import type { CalendarEvent } from "@/lib/calendar";
import { toggleEvent } from "./actions";
import { cx, statusOf, type Tone } from "./utils";

const OVERDUE_CAP = 8;

const TEXT: Record<Tone, string> = {
  red: "text-red-600",
  blue: "text-blue-600",
  green: "text-emerald-600",
  grey: "text-muted",
  amber: "text-amber-600",
};

function Hidden({ e, next }: { e: CalendarEvent; next: "DONE" | "TODO" }) {
  return (
    <>
      <input type="hidden" name="kind" value={e.kind} />
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="next" value={next} />
    </>
  );
}

function Sub({ e, role, today }: { e: CalendarEvent; role: Role; today: string }) {
  const parts = [e.kind === "MEETING" ? e.time : null, e.projectName, role === "ADMIN" ? e.ownerName : null].filter(Boolean);
  const status = e.date < today && !e.done ? statusOf(e, today) : null;
  return (
    <span className="block truncate text-[11px] text-muted">
      {parts.join(" · ")}
      {status ? <span className={cx(parts.length > 0 && "ml-1", TEXT[status.tone])}>{status.text}</span> : null}
    </span>
  );
}

function Item({ e, role, today }: { e: CalendarEvent; role: Role; today: string }) {
  const late = e.date < today && !e.done;

  if (e.done) {
    return (
      <li className="flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-[10px] text-white">✓</span>
        <span className="min-w-0 flex-1 truncate text-muted line-through">{e.title}</span>
        {e.toggleable ? (
          <form action={toggleEvent}>
            <Hidden e={e} next="TODO" />
            <button type="submit" className="text-[11px] text-muted hover:text-foreground hover:underline">
              撤销
            </button>
          </form>
        ) : null}
      </li>
    );
  }

  if (e.toggleable) {
    return (
      <li>
        <form action={toggleEvent}>
          <Hidden e={e} next="DONE" />
          <button type="submit" className="group flex w-full items-start gap-2 rounded-md text-left hover:bg-zinc-50" title="点一下标记完成">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-zinc-400 bg-white group-hover:border-accent" />
            <span className="min-w-0 flex-1">
              <span className={cx("block truncate leading-5", late && "text-red-700")}>{e.title}</span>
              <Sub e={e} role={role} today={today} />
            </span>
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-dashed border-zinc-300" />
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate leading-5", late && "text-red-700")}>{e.title}</span>
        <Sub e={e} role={role} today={today} />
      </span>
      <Link href={e.href} className="shrink-0 text-xs text-accent hover:underline">
        {e.kind === "MEETING" || role === "ADMIN" ? "查看" : "去提交"}
      </Link>
    </li>
  );
}

/** 当日 checklist：未完成的超期项（红，最多 8 条）在前，然后是今天到期的全部事项 */
export function Checklist({ events, today, role }: { events: CalendarEvent[]; today: string; role: Role }) {
  const overdueAll = events.filter((e) => !e.done && e.date < today);
  const overdue = overdueAll.slice(0, OVERDUE_CAP);
  const todays = events.filter((e) => e.date === today);
  const doneToday = todays.filter((e) => e.done).length;
  const hasTimeline = [...overdue, ...todays].some((e) => e.kind === "TIMELINE");

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-muted">当日 checklist</h3>
        {todays.length > 0 ? (
          <span className="text-xs text-muted">
            {doneToday}/{todays.length}
          </span>
        ) : null}
      </div>
      {overdueAll.length === 0 && todays.length === 0 ? (
        <p className="mt-2 text-xs text-muted">今天没有待办</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {overdue.map((e) => (
            <Item key={`${e.kind}-${e.id}`} e={e} role={role} today={today} />
          ))}
          {overdueAll.length > OVERDUE_CAP ? <li className="text-[11px] text-red-600">还有 {overdueAll.length - OVERDUE_CAP} 项已超期</li> : null}
          {todays.map((e) => (
            <Item key={`${e.kind}-${e.id}`} e={e} role={role} today={today} />
          ))}
        </ul>
      )}
      {hasTimeline ? <p className="mt-3 text-[11px] text-muted">超期一周后开始扣分</p> : null}
    </section>
  );
}
