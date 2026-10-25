import type { TimelineDiff } from "@/lib/timeline";

const md = (ymd: string) => ymd.slice(5);

/** timeline 修改申请的差异：新增 / 改期 / 删除，一眼看清改了什么 */
export function TimelineDiffView({ diff }: { diff: TimelineDiff }) {
  const empty = !diff.added.length && !diff.moved.length && !diff.removed.length;
  return (
    <div className="space-y-2 text-sm">
      {empty ? <p className="text-muted">与当前 timeline 相比没有变化。</p> : null}
      {diff.moved.length ? (
        <div>
          <div className="text-xs font-semibold text-amber-800">改期 {diff.moved.length}</div>
          <ul className="mt-1 space-y-0.5">
            {diff.moved.map((m) => (
              <li key={m.id} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums text-muted line-through">{md(m.from)}</span>
                <span className="tabular-nums font-medium text-amber-800">→ {md(m.to)}</span>
                <span>{m.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {diff.added.length ? (
        <div>
          <div className="text-xs font-semibold text-emerald-700">新增 {diff.added.length}</div>
          <ul className="mt-1 space-y-0.5">
            {diff.added.map((a, i) => (
              <li key={i} className="flex gap-x-2">
                <span className="tabular-nums font-medium text-emerald-700">+ {md(a.dueDate)}</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {diff.removed.length ? (
        <div>
          <div className="text-xs font-semibold text-red-700">删除 {diff.removed.length}</div>
          <ul className="mt-1 space-y-0.5">
            {diff.removed.map((r) => (
              <li key={r.id} className="flex gap-x-2 text-muted">
                <span className="tabular-nums">− {md(r.dueDate)}</span>
                <span className="line-through">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted">
        不变 {diff.unchanged} 条{diff.keptDone ? ` · 已完成 ${diff.keptDone} 条保留不动` : ""}
      </p>
    </div>
  );
}
