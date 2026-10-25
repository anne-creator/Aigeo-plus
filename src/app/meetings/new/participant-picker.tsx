"use client";

import { useState } from "react";

export interface PickerGroup {
  key: string;
  label: string;
  people: Array<{ id: string; name: string; hint?: string }>;
}

/** 参会人选择：按角色分组，每组可以一键全选；提交字段名 invitees */
export function ParticipantPicker({ groups }: { groups: PickerGroup[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setGroup = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const ids = g.people.map((p) => p.id);
        const all = ids.length > 0 && ids.every((id) => picked.has(id));
        return (
          <fieldset key={g.key} className="rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-semibold">{g.label}</legend>
            {g.people.length === 0 ? (
              <p className="text-xs text-muted">暂无可选人员</p>
            ) : (
              <>
                <button type="button" onClick={() => setGroup(ids, !all)} className="mb-2 text-xs text-accent hover:underline">
                  {all ? "取消全选" : "全选"}
                </button>
                <div className="flex flex-wrap gap-2">
                  {g.people.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                          on ? "border-accent bg-blue-50 text-accent" : "border-border bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <input type="checkbox" name="invitees" value={p.id} checked={on} onChange={() => toggle(p.id)} className="sr-only" />
                        {on ? "✓ " : ""}
                        {p.name}
                        {p.hint ? <span className="ml-1 text-xs text-muted">{p.hint}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </fieldset>
        );
      })}
      <p className="text-xs text-muted">已选 {picked.size} 人。所有人都同意后，会议才会进入每个人的日历。</p>
    </div>
  );
}
