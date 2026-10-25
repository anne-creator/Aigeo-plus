import Link from "next/link";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getAssigneeWork } from "@/lib/pay";
import { formatMinutes } from "@/lib/tasks";

export default async function AssigneeWorkPage() {
  const session = await requireSession(["INTERN"]);
  const w = await getAssigneeWork(session.uid);
  const max = Math.max(60, ...w.weeks.map((x) => x.minutes));

  return (
    <>
      <PageHeader title="我的工时" description="按完成任务的预计用时累计；按时完成率看截止前是否完成" />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="本周工时" value={formatMinutes(w.weekMinutes)} />
          <Stat label="本月工时" value={formatMinutes(w.monthMinutes)} />
          <Stat
            label="按时完成率"
            value={w.onTimePct === null ? "—" : `${w.onTimePct}%`}
            tone={w.onTimePct !== null && w.onTimePct >= 90 ? "green" : w.onTimePct !== null && w.onTimePct < 70 ? "red" : undefined}
            hint={`已完成 ${w.doneCount} 个，其中晚完成 ${w.lateDoneCount} 个`}
          />
          <Stat
            label="已过截止未完成"
            value={w.overdueOpen}
            tone={w.overdueOpen > 0 ? "red" : undefined}
            hint={
              <Link href="/intern" className="text-accent hover:underline">
                共 {w.openCount} 个待办 →
              </Link>
            }
          />
        </div>

        <Card>
          <CardTitle right={<span className="text-xs text-muted">最近 6 周</span>}>每周工时</CardTitle>
          <div className="flex h-48 items-end gap-3">
            {w.weeks.map((x, i) => {
              const last = i === w.weeks.length - 1;
              return (
                <div key={x.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs tabular-nums text-muted">{x.minutes > 0 ? formatMinutes(x.minutes) : ""}</span>
                  <div
                    className={`w-full max-w-14 rounded-t-md ${last ? "bg-accent" : "bg-zinc-300"}`}
                    style={{ height: `${(x.minutes / max) * 80}%`, minHeight: x.minutes > 0 ? 4 : 1 }}
                  />
                  <span className={`text-xs ${last ? "font-semibold" : "text-muted"}`}>{last ? "本周" : x.weekStart.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
