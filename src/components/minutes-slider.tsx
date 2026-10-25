"use client";

import { useState } from "react";
import { DEFAULT_TASK_MINUTES, MAX_TASK_MINUTES, TASK_MINUTES_STEP, formatMinutes } from "@/lib/minutes";

/** 预计用时滑动条：0–180 分钟，每格 5 分钟，右侧实时显示 */
export function MinutesSlider({ name, defaultValue = DEFAULT_TASK_MINUTES, label = "预计用时" }: { name: string; defaultValue?: number; label?: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <div className="flex-1">
        <input
          type="range"
          name={name}
          min={0}
          max={MAX_TASK_MINUTES}
          step={TASK_MINUTES_STEP}
          value={v}
          onChange={(e) => setV(Number(e.currentTarget.value))}
          aria-label={`${label}（分钟）`}
          aria-valuetext={formatMinutes(v)}
          className="h-1.5 w-full cursor-pointer accent-blue-600"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>0</span>
          <span>60</span>
          <span>120</span>
          <span>180 分钟</span>
        </div>
      </div>
      <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">{formatMinutes(v)}</span>
    </div>
  );
}
