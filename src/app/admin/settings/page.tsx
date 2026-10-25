import { Alert, Button, Card, CardTitle, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { DEFAULT_RULES, DELIVERABLE_CODES, DELIVERABLE_META } from "@/lib/rules";
import { getRulesConfig } from "@/lib/settings";
import { one } from "../_lib";
import { aiCredentialsConfigured, aiModel } from "@/lib/ai-config";
import { AiConnectionTest } from "./ai-connection";
import { resetSettings, saveAiReviewSettings, saveSettings } from "./actions";

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const saved = one(sp.saved);
  const config = await getRulesConfig();
  const aiConfigured = aiCredentialsConfigured();

  return (
    <>
      <PageHeader title="系统设置" description="权重、扣分比例、汇率与提交窗口。保存后进行中/已暂停项目的节点截止日会按新窗口重算；得分按当前规则即时重算" />
      {error ? (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <Alert tone="green">设置已保存，节点已重新同步。</Alert>
        </div>
      ) : null}

      <div className="mb-6">
        <Card>
          <CardTitle>OpenAI 连接</CardTitle>
          <Alert tone={aiConfigured ? "blue" : "amber"}>
            {aiConfigured ? "已配置 API Key。点击下方按钮验证连接和模型权限。" : "尚未配置 API Key：Timeline 和任务整理使用基础提取，材料由管理员人工审核。"}
          </Alert>
          <p className="mt-3 text-sm text-muted">三个 AI 功能共用 OpenAI API Key。管理员在服务器环境变量 OPENAI_API_KEY 中配置密钥，本地运行可填写项目 .env 文件，然后重启服务。</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {([["timeline", "Timeline 文件识别"], ["review", "交付材料审核"], ["tasks", "任务整理"]] as const).map(([workload, label]) => (
              <div key={workload} className="rounded-lg border border-border p-3">
                <div>{label}</div><div className="mt-1 break-all text-xs text-muted">{aiModel(workload)}</div>
              </div>
            ))}
          </div>
          <AiConnectionTest configured={aiConfigured} />
        </Card>
      </div>

      <form action={saveAiReviewSettings} className="mb-6">
        <Card>
          <CardTitle>AI 审核与自动扣除</CardTitle>
          {!aiConfigured ? (
            <div className="mb-3">
              <Alert tone="amber">服务器没有配置 OPENAI_API_KEY：AI 审核暂不运行，提交的材料停在「待审核」由管理员人工审核。配置后重启即可生效。</Alert>
            </div>
          ) : null}
          <p className="mb-3 text-xs text-muted">
            项目经理每次提交材料后，AI 核对季初约定（基线报告与季度规划）与月报、周一复盘、季末报告是否对得上，打 0–100 分。达到通过线自动通过；低于通过线自动判不通过，按下表扣该项权重，当季 KPI 奖随之按比例减少。管理员可随时改判或让 AI 重新审核。
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" value="1" defaultChecked={config.aiReview.enabled} className="h-4 w-4" />
              启用 AI 审核
            </label>
            <Field label="通过线（分）">
              <Input name="passScore" type="number" min={0} max={100} step={1} defaultValue={config.aiReview.passScore} required className="w-28" />
            </Field>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const b = config.aiReview.bands[i] ?? DEFAULT_RULES.aiReview.bands[i];
              return (
                <div key={i} className="flex items-end gap-2 rounded-lg border border-border p-3">
                  <Field label="分数 ≥">
                    <Input name={`band_min_${i}`} type="number" min={0} max={100} step={1} defaultValue={b.minScore} required className="w-20" />
                  </Field>
                  <Field label="扣该项（%）">
                    <Input name={`band_pct_${i}`} type="number" min={0} max={100} step={1} defaultValue={b.deductionPct} required className="w-24" />
                  </Field>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Button type="submit">保存 AI 审核设置</Button>
          </div>
        </Card>
      </form>

      <form action={saveSettings} className="space-y-6">
        <Card>
          <CardTitle>KPI 奖与审核参数</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="美元→人民币汇率" hint={`默认 ${DEFAULT_RULES.fxRate}；结算时可按季度单独修正`}>
              <Input name="fxRate" type="number" min={0.0001} step="0.0001" defaultValue={config.fxRate} required />
            </Field>
            <Field label="月提成比例（%）" hint="薪酬规则固定 10%；超过 $5,000/月的项目另行约定，不自动套用标准规则">
              <Input name="commissionPct" type="number" value={10} readOnly />
            </Field>
            <Field label="审核不通过额外扣分（%）" hint={`默认 ${DEFAULT_RULES.reviewRejectDeductionPct}%：扣该项权重的比例，审核时可逐项调整`}>
              <Input name="reviewRejectDeductionPct" type="number" min={0} max={100} step="1" defaultValue={config.reviewRejectDeductionPct} required />
            </Field>
            <Field label="月报 / 分发清单提交窗口（天）" hint={`默认 ${DEFAULT_RULES.monthlyReportWindowDays}：每 30 天服务月结束后几天内提交`}>
              <Input name="monthlyReportWindowDays" type="number" min={1} max={60} step={1} defaultValue={config.monthlyReportWindowDays} required />
            </Field>
            <Field label="季末报告提交窗口（天）" hint={`默认 ${DEFAULT_RULES.quarterReportWindowDays}：季度结束后几天内提交`}>
              <Input name="quarterReportWindowDays" type="number" min={1} max={60} step={1} defaultValue={config.quarterReportWindowDays} required />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>项目 timeline 条目（日历 checklist）</CardTitle>
          <p className="mb-3 text-sm text-muted">
            项目经理上传的 timeline 条目进入日历与当日 checklist，勾选即完成。超过截止日“宽限天数”仍未完成才开始扣分，之后每天扣该条权重的一定比例，封顶 100%；结算时仍未完成的扣 100%。
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="每条权重（分）" hint={`默认 ${DEFAULT_RULES.timeline.weight}`}>
              <Input name="timelineWeight" type="number" min={0} max={100} step="0.5" defaultValue={config.timeline.weight} required />
            </Field>
            <Field label="宽限天数" hint={`默认 ${DEFAULT_RULES.timeline.graceDays}：迟完成一周内不扣分`}>
              <Input name="timelineGraceDays" type="number" min={0} max={60} step={1} defaultValue={config.timeline.graceDays} required />
            </Field>
            <Field label="宽限后每天扣（%）" hint={`默认 ${DEFAULT_RULES.timeline.penaltyPerDayPct}%`}>
              <Input name="timelinePenaltyPerDayPct" type="number" min={0} max={100} step="0.01" defaultValue={config.timeline.penaltyPerDayPct} required />
            </Field>
          </div>
        </Card>


        <Card>
          <CardTitle>交付物权重与延期扣分</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>交付物</Th>
                <Th>代码</Th>
                <Th>启用</Th>
                <Th>权重（分）</Th>
                <Th>每延期 1 天扣（%）</Th>
                <Th>扣满所需天数</Th>
                <Th>默认值</Th>
              </tr>
            </thead>
            <tbody>
              {DELIVERABLE_CODES.map((code) => {
                const meta = DELIVERABLE_META[code];
                const cur = config.deliverables[code];
                const def = DEFAULT_RULES.deliverables[code];
                const fullDays = cur.penaltyPerDayPct > 0 ? Math.ceil(100 / cur.penaltyPerDayPct) : null;
                return (
                  <tr key={code}>
                    <Td>
                      <div className="font-medium">{meta.name}</div>
                      <div className="text-xs text-muted">{meta.description}</div>
                    </Td>
                    <Td className="text-xs text-muted">{code}</Td>
                    <Td>
                      <input name={`enabled_${code}`} type="checkbox" value="1" defaultChecked={cur.enabled ?? true} aria-label={`启用 ${meta.name}`} className="h-4 w-4" />
                    </Td>
                    <Td>
                      <Input name={`weight_${code}`} type="number" min={0} max={1000} step="0.5" defaultValue={cur.weight} required className="w-24" />
                    </Td>
                    <Td>
                      <Input name={`penalty_${code}`} type="number" min={0} max={100} step="0.01" defaultValue={cur.penaltyPerDayPct} required className="w-24" />
                    </Td>
                    <Td className="whitespace-nowrap">{fullDays === null ? "—" : `${fullDays} 天`}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {def.weight} 分 · {def.penaltyPerDayPct}%/天{def.enabled === false ? " · 默认关闭" : ""}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="mt-4 space-y-1 rounded-lg bg-zinc-50 p-3 text-xs text-muted">
            <div className="font-medium text-foreground">扣分规则（规则说明第 4 节）</div>
            <div>启用：取消勾选后不再生成该类节点，进行中项目里尚未提交的该类节点会被移除（已提交的保留）；建议项「续约推进计划」「新季度规划方案」默认关闭，勾选并保存即可启用。</div>
            <div>延期天数 = ⌈(首次提交时间 − 截止时间) ÷ 24h⌉，按北京时间计算；截止后 1 分钟提交也算延期 1 天。</div>
            <div>单项延期扣分 = 权重 × min(100%, 延期天数 × 每日扣分比例)；至结算仍未提交的，扣 100%。</div>
            <div>审核不通过：另扣该项权重 × 审核扣分比例（默认见上），项目经理重新提交不改变首次提交时间，延期扣分只算一次。</div>
            <div>季度交付得分 = 1 − Σ(单项延期扣分 + 单项审核扣分) ÷ Σ(权重)，范围 0–100%；未到期且未提交的节点不计入分母。</div>
            <div>季度 KPI 奖 = 月提成 × 档位系数 × 季度交付得分；档位系数：达成率 ≥130% → 100%，100–130% → 60%，&lt;100% → 0。</div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">保存设置</Button>
          <Button type="submit" variant="secondary" formAction={resetSettings} formNoValidate>
            恢复默认值
          </Button>
        </div>
      </form>
    </>
  );
}
