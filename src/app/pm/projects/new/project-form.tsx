"use client";

import { useActionState } from "react";
import { Alert, Button, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { CLIENT_SOURCES } from "@/lib/channels";
import { PLAN_TIERS } from "@/lib/rules/defaults";
import { createProjectAction, type ProjectFormState } from "../actions";
import { KpiRow } from "./kpi-row";

const INITIAL: ProjectFormState = { error: null, values: {}, seq: 0 };

/** 新建客户档案：填错时只提示，已填写的内容原样保留 */
export function ProjectForm({ today, kpiRows }: { today: string; kpiRows: number }) {
  const [state, action, pending] = useActionState(createProjectAction, INITIAL);
  const v = (k: string, d = "") => state.values[k] ?? d;

  return (
    // key 随每次出错变化：表单按上次填写的内容重新渲染（React 提交后会重置表单）
    <form key={state.seq} action={action} className="space-y-6">
      {state.error ? (
        <div role="alert">
          <Alert tone="red">{state.error}（已填写的内容都保留着，改好后再保存即可）</Alert>
        </div>
      ) : null}

      <Card>
        <CardTitle>客户信息</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="客户名称 *">
            <Input name="clientName" required maxLength={100} placeholder="例如：Acme SaaS" defaultValue={v("clientName")} />
          </Field>
          <Field label="客户官网" hint="选填，例如 acme.com">
            <Input name="websiteUrl" maxLength={300} placeholder="acme.com" defaultValue={v("websiteUrl")} />
          </Field>
          <Field label="项目开始日期（D0）*" hint="北京时间；第 1 天即提示词池截止日">
            <Input name="startDate" type="date" required defaultValue={v("startDate", today)} />
          </Field>
          <Field label="方案档位 *">
            <Select name="planTier" required defaultValue={v("planTier")}>
              <option value="" disabled>
                请选择
              </option>
              {PLAN_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="月服务费（美元）*" hint="用于月提成与季度 KPI 奖测算">
            <Input name="monthlyFeeUsd" type="number" min={1} step="0.01" required placeholder="3300" defaultValue={v("monthlyFeeUsd")} />
          </Field>
          <Field label="合同月数 *" hint="默认 3（一个季度），1–24；续约时由管理员延长">
            <Input name="contractMonths" type="number" min={1} max={24} step={1} required defaultValue={v("contractMonths", "3")} />
          </Field>
          <Field label="客户来源 *" hint="渠道方推荐的客户，渠道方可在其专属页面查看进度">
            <Select name="source" required defaultValue={v("source", "DIRECT")}>
              {CLIENT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="备注">
            <Textarea name="notes" maxLength={2000} placeholder="选填：客户背景、特别约定等" defaultValue={v("notes")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>承诺交付 KPI</CardTitle>
        <p className="mb-3 text-xs text-muted">
          第 1 条固定为「提示词池 ShowUp 率」，必填；第 2–5 条选填，例如 Reddit 发稿 12 篇/季、可见度提升 +20 个百分点。
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-muted">#</th>
                <th className="bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-muted">指标类型</th>
                <th className="bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-muted">指标名</th>
                <th className="bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-muted">目标值</th>
                <th className="bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-muted">单位</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50/40">
                <td className="px-2 py-2 text-xs text-muted">1</td>
                <td className="px-2 py-2">
                  <Input value="提示词池 ShowUp 率（固定）" readOnly className="bg-zinc-50 text-muted" />
                  <input type="hidden" name="kpi_0_metricType" value="SHOWUP_RATE" />
                </td>
                <td className="px-2 py-2">
                  <Input name="kpi_0_name" value="提示词池 ShowUp 率" readOnly className="bg-zinc-50 text-muted" />
                </td>
                <td className="px-2 py-2">
                  <Input name="kpi_0_target" type="number" min={0.1} max={100} step="0.1" required placeholder="例如 50" defaultValue={v("kpi_0_target")} />
                </td>
                <td className="px-2 py-2">
                  <Input name="kpi_0_unit" value="%" readOnly className="bg-zinc-50 text-muted" />
                </td>
              </tr>
              {Array.from({ length: kpiRows - 1 }, (_, i) => {
                const n = i + 1;
                return (
                  <KpiRow
                    key={n}
                    index={n}
                    initial={{ metricType: v(`kpi_${n}_metricType`), name: v(`kpi_${n}_name`), target: v(`kpi_${n}_target`), unit: v(`kpi_${n}_unit`) }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "正在保存…" : "保存并生成交付时间线"}
        </Button>
        <span className="text-xs text-muted">保存后将跳转到项目详情，可在时间线中核对各节点截止日。</span>
      </div>
    </form>
  );
}
