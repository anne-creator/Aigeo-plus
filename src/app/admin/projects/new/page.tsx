import { Alert, Button, Card, CardTitle, Field, Input, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { CLIENT_SOURCES } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { KPI_METRIC_TYPES, PLAN_TIERS } from "@/lib/rules";
import { one } from "../../_lib";
import { createProject } from "../actions";

export default async function NewProject({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const pms = await prisma.user.findMany({ where: { role: "PM", active: true }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="新建项目" description="管理员代建客户档案；建档后自动生成全部交付节点" actions={<LinkButton href="/admin/projects" variant="secondary">返回列表</LinkButton>} />
      {error ? (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : null}
      {pms.length === 0 ? (
        <div className="mb-4">
          <Alert tone="amber">还没有可用的项目经理账号，请先在「账号管理」中创建。</Alert>
        </div>
      ) : null}
      <form action={createProject} className="space-y-6">
        <Card>
          <CardTitle>客户档案</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="客户名称">
              <Input name="clientName" required maxLength={200} />
            </Field>
            <Field label="客户官网" hint="选填，例如 acme.com">
              <Input name="websiteUrl" maxLength={300} placeholder="acme.com" />
            </Field>
            <Field label="项目开始日期（D0）" hint="所有交付节点从这一天起算，北京时间">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="方案档位">
              <Select name="planTier" required defaultValue="">
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
            <Field label="月服务费（美元）">
              <Input name="monthlyFeeUsd" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="合同月数" hint="默认 3（一个季度）；每 30 天为一个服务月">
              <Input name="contractMonths" type="number" min={1} max={120} step={1} defaultValue={3} required />
            </Field>
            <Field label="项目经理">
              <Select name="pmId" required defaultValue="">
                <option value="" disabled>
                  请选择
                </option>
                {pms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.username}）
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="客户来源" hint="直客或渠道方推荐；渠道方可在专属页面查看本渠道客户的进度">
              <Select name="source" required defaultValue="DIRECT">
                {CLIENT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="提示词池 ShowUp 率目标（%）" hint="季度 KPI 奖的计算依据：效果达成率 = 实际 ShowUp 率 ÷ 该目标">
              <Input name="showupTarget" type="number" min={0.01} max={100} step="0.01" required />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="备注（选填）">
              <Textarea name="notes" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>其它承诺 KPI（选填，最多 3 条；建档后可在详情页继续增删）</CardTitle>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-4">
                <Select name={`kpiType${i}`} defaultValue="CUSTOM">
                  {KPI_METRIC_TYPES.filter((t) => t.value !== "SHOWUP_RATE").map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <Input name={`kpiName${i}`} placeholder="指标名，如 Reddit 发稿篇数" />
                <Input name={`kpiTarget${i}`} type="number" step="0.01" placeholder="目标值" />
                <Input name={`kpiUnit${i}`} placeholder="单位，如 篇/季" />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={pms.length === 0}>
            建档并生成交付节点
          </Button>
          <LinkButton href="/admin/projects" variant="secondary">
            取消
          </LinkButton>
        </div>
      </form>
    </>
  );
}
