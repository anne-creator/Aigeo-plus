"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { DraftTask } from "@/lib/tasks";
import { DEFAULT_TASK_MINUTES, MAX_TASK_MINUTES, TASK_MINUTES_STEP, formatMinutes } from "@/lib/minutes";
import { confirmBatchAction, discardBatchAction, saveDraftAction } from "../actions";

interface Row {
  key: number;
  title: string;
  date: string;
  note: string;
  /** 预计用时（分钟） */
  minutes: number;
  remove: boolean;
}

const EMPTY_ROWS = 2;

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-blue-100";

/** 草稿清单：逐条核对日期和内容，确认下发 / 保存修改 / 放弃 */
export function DraftEditor({ batchId, items, assigneeName }: { batchId: string; items: DraftTask[]; assigneeName: string }) {
  const blank = (key: number): Row => ({ key, title: "", date: "", note: "", minutes: DEFAULT_TASK_MINUTES, remove: false });
  const [rows, setRows] = useState<Row[]>(() => {
    const filled = items.map((t, i) => ({
      key: i,
      title: t.title,
      date: t.dueDate ?? "",
      note: t.note ?? "",
      minutes: t.estimatedMinutes ?? DEFAULT_TASK_MINUTES,
      remove: false,
    }));
    const extra = Array.from({ length: items.length ? EMPTY_ROWS : EMPTY_ROWS + 1 }, (_, j) => blank(items.length + j));
    return [...filled, ...extra];
  });
  const [hint, setHint] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const patch = (key: number, p: Partial<Row>) => {
    setHint("");
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  const active = rows.filter((r) => !r.remove && r.title.trim());
  const missing = active.filter((r) => !r.date);
  const totalMinutes = active.reduce((sum, r) => sum + r.minutes, 0);

  return (
    <form
      ref={formRef}
      action={confirmBatchAction}
      className="space-y-3"
      onKeyDown={(e) => {
        // 回车不提交，避免误触发“放弃”/“下发”
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="count" value={rows.length} />

      <ol className="space-y-2">
        {rows.map((r, i) => {
          const needsDate = !r.remove && r.title.trim() !== "" && !r.date;
          return (
            <li
              key={r.key}
              data-missing={needsDate || undefined}
              className={[
                "rounded-xl border p-3 transition",
                needsDate ? "border-red-300 bg-red-50" : "border-border bg-white",
                r.remove ? "opacity-40" : "",
              ].join(" ")}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 sm:w-48 sm:shrink-0">
                  <span className="w-5 text-right text-xs text-muted">{i + 1}</span>
                  <input
                    type="date"
                    name={`item_${i}_date`}
                    value={r.date}
                    onChange={(e) => patch(r.key, { date: e.currentTarget.value })}
                    aria-label={`第 ${i + 1} 条截止日期`}
                    className={`${field} ${needsDate ? "border-red-400" : "border-border"}`}
                  />
                </div>
                <input
                  name={`item_${i}_title`}
                  value={r.title}
                  maxLength={300}
                  onChange={(e) => patch(r.key, { title: e.currentTarget.value })}
                  placeholder={i >= items.length ? "新增一条（选填）" : "任务内容"}
                  aria-label={`第 ${i + 1} 条任务内容`}
                  className={`${field} border-border ${r.remove ? "line-through" : ""}`}
                />
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted sm:pl-1">
                  <input
                    type="checkbox"
                    name={`item_${i}_remove`}
                    checked={r.remove}
                    onChange={(e) => patch(r.key, { remove: e.currentTarget.checked })}
                  />
                  删除
                </label>
              </div>
              <div className="mt-2 flex items-center gap-3 sm:pl-7">
                <span className="shrink-0 text-xs text-muted">预计用时</span>
                <div className="flex-1">
                  <input
                    type="range"
                    name={`item_${i}_minutes`}
                    min={0}
                    max={MAX_TASK_MINUTES}
                    step={TASK_MINUTES_STEP}
                    value={r.minutes}
                    disabled={r.remove}
                    onChange={(e) => patch(r.key, { minutes: Number(e.currentTarget.value) })}
                    aria-label={`第 ${i + 1} 条预计用时（分钟）`}
                    aria-valuetext={formatMinutes(r.minutes)}
                    className="h-1.5 w-full cursor-pointer accent-blue-600"
                  />
                  <div className="mt-0.5 flex justify-between text-[10px] text-muted">
                    <span>0</span>
                    <span>60</span>
                    <span>120</span>
                    <span>180 分钟</span>
                  </div>
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">{formatMinutes(r.minutes)}</span>
              </div>
              <input type="hidden" name={`item_${i}_note`} value={r.note} />
              {needsDate ? <p className="mt-1.5 pl-7 text-xs font-medium text-red-700">请补日期</p> : null}
              {r.note ? <p className="mt-1.5 pl-7 text-xs text-muted">{r.note}</p> : null}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={() => setRows((rs) => [...rs, blank(Math.max(-1, ...rs.map((r) => r.key)) + 1)])} className="text-sm text-accent hover:underline">
        + 再加一行
      </button>

      {hint ? <p className="text-sm font-medium text-red-700">{hint}</p> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          variant="ghost"
          formAction={discardBatchAction}
          formNoValidate
          className="text-muted"
          onClick={(e) => {
            if (!window.confirm("放弃这份清单？不会下发给负责人。")) e.preventDefault();
          }}
        >
          放弃
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button type="submit" variant="secondary" formAction={saveDraftAction} formNoValidate>
            保存修改
          </Button>
          <Button
            type="submit"
            className="px-6 py-2.5"
            disabled={active.length === 0}
            onClick={(e) => {
              if (missing.length) {
                e.preventDefault();
                setHint(`还有 ${missing.length} 条没填日期`);
                formRef.current?.querySelector<HTMLInputElement>("li[data-missing] input[type=date]")?.focus();
              }
            }}
          >
            确认下发 {active.length} 条
          </Button>
        </div>
      </div>
      <p className="text-right text-xs text-muted">
        合计预计 {formatMinutes(totalMinutes)} · 确认后进入 {assigneeName} 的日历和待办，完成后计入其周工作时长
      </p>
    </form>
  );
}
