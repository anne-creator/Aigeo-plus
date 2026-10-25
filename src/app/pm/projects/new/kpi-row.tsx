"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import { KPI_METRIC_TYPES } from "@/lib/rules/defaults";

type MetricType = (typeof KPI_METRIC_TYPES)[number]["value"];

function metaOf(v: string) {
  return KPI_METRIC_TYPES.find((k) => k.value === v);
}

/** 可选 KPI 行：选指标类型后自动带出默认指标名与单位（仍可手改） */
export function KpiRow({
  index,
  initial,
}: {
  index: number;
  /** 出错回填：上次提交时这一行填的内容 */
  initial?: { metricType?: string; name?: string; target?: string; unit?: string };
}) {
  const [metricType, setMetricType] = useState<MetricType | "">((initial?.metricType as MetricType) ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");

  function onTypeChange(next: string) {
    const prev = metaOf(metricType);
    const meta = metaOf(next);
    setMetricType(next as MetricType | "");
    if (!name || (prev && name === prev.label)) setName(meta?.label ?? "");
    if (!unit || (prev && unit === prev.defaultUnit)) setUnit(meta?.defaultUnit ?? "");
  }

  return (
    <tr>
      <td className="border-t border-border px-2 py-2 text-xs text-muted">{index + 1}</td>
      <td className="border-t border-border px-2 py-2">
        <Select name={`kpi_${index}_metricType`} value={metricType} onChange={(e) => onTypeChange(e.target.value)}>
          <option value="">— 不填 —</option>
          {KPI_METRIC_TYPES.filter((k) => k.value !== "SHOWUP_RATE").map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="border-t border-border px-2 py-2">
        <Input name={`kpi_${index}_name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="指标名" maxLength={60} />
      </td>
      <td className="border-t border-border px-2 py-2">
        <Input name={`kpi_${index}_target`} type="number" step="any" placeholder="目标值" defaultValue={initial?.target ?? ""} />
      </td>
      <td className="border-t border-border px-2 py-2">
        <Input name={`kpi_${index}_unit`} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="单位" maxLength={20} />
      </td>
    </tr>
  );
}
