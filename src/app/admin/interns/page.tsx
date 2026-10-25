import Link from "next/link";
import { Alert, Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { MinutesSlider } from "@/components/minutes-slider";
import { dutyRoleLabel, formatMinutes, weeklyWorkFor } from "@/lib/tasks";
import { formatBj, formatBjDate, toBjYmd } from "@/lib/time";
import { TaskStatusBadge } from "../_components";
import { fileSizeText, one } from "../_lib";
import { createInternTask, deleteInternTask, setInternTaskStatus } from "./actions";

export default async function AdminAssigneeTasks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const saved = one(sp.saved);
  const now = new Date();

  const [assignees, tasks, projects] = await Promise.all([
    prisma.user.findMany({ where: { role: "INTERN" }, orderBy: [{ active: "desc" }, { dutyRole: "asc" }, { name: "asc" }] }),
    prisma.internTask.findMany({
      include: {
        createdBy: { select: { name: true } },
        project: { select: { id: true, clientName: true } },
        submissions: { orderBy: { submittedAt: "desc" } },
      },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.project.findMany({ select: { id: true, clientName: true }, orderBy: { clientName: "asc" } }),
  ]);
  const active = assignees.filter((u) => u.active);
  const weekWork = await weeklyWorkFor(assignees.map((u) => u.id), now);
  const groups = assignees
    .map((u) => ({ user: u, tasks: tasks.filter((t) => t.assigneeId === u.id) }))
    .filter((g) => g.user.active || g.tasks.length > 0);

  return (
    <>
      <PageHeader title="负责人任务" description="项目经理通过「分配任务」下发；管理员也可在此单独新建" />
      {error ? (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4">
          <Alert tone="green">已保存。</Alert>
        </div>
      ) : null}

      <Card>
        <CardTitle>新建任务</CardTitle>
        {active.length === 0 ? (
          <Alert tone="amber">还没有启用中的负责人账号，请先在「账号管理」中创建。</Alert>
        ) : (
          <form action={createInternTask} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="负责人">
              <Select name="assigneeId" required defaultValue="">
                <option value="" disabled>
                  请选择
                </option>
                {active.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {dutyRoleLabel(u.dutyRole)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="客户（选填）">
              <Select name="projectId" defaultValue="">
                <option value="">不关联客户</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="任务标题">
              <Input name="title" required maxLength={200} />
            </Field>
            <Field label="截止日期" hint="北京时间当天 23:59 截止">
              <Input name="dueDate" type="date" defaultValue={toBjYmd(now)} />
            </Field>
            <div className="flex items-start pt-6">
              <Button type="submit" className="w-full">
                新建任务
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <MinutesSlider name="estimatedMinutes" />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Field label="任务说明（选填）">
                <Textarea name="description" maxLength={2000} className="min-h-16" />
              </Field>
            </div>
          </form>
        )}
      </Card>

      <div className="mt-6 space-y-4">
        {groups.length === 0 ? (
          <Card>
            <Empty>还没有负责人任务</Empty>
          </Card>
        ) : null}
        {groups.map((g) => {
          const todo = g.tasks.filter((t) => t.status !== "DONE").length;
          return (
            <Card key={g.user.id}>
              <CardTitle
                right={
                  <span className="text-xs text-muted">
                    本周工作时长 <span className="font-semibold text-foreground">{formatMinutes(weekWork.get(g.user.id)?.totalMinutes ?? 0)}</span> · 待完成 {todo} · 已完成 {g.tasks.length - todo}
                  </span>
                }
              >
                {g.user.name}
                <Badge tone={g.user.dutyRole ? "blue" : "amber"} className="ml-2">
                  {g.user.dutyRole ? dutyRoleLabel(g.user.dutyRole) : "未设类型"}
                </Badge>
                {!g.user.active ? <Badge tone="zinc" className="ml-2">已停用</Badge> : null}
              </CardTitle>
              {g.tasks.length === 0 ? (
                <Empty>暂无任务</Empty>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>任务</Th>
                      <Th>客户</Th>
                      <Th>分配人</Th>
                      <Th>截止</Th>
                      <Th>预计用时</Th>
                      <Th>状态</Th>
                      <Th>交付</Th>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.tasks.map((t) => (
                      <tr key={t.id}>
                        <Td>
                          <div className={t.status === "DONE" ? "text-muted line-through" : "font-medium"}>{t.title}</div>
                          {t.description ? <div className="mt-0.5 max-w-md whitespace-pre-wrap text-xs text-muted">{t.description}</div> : null}
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          {t.project ? (
                            <Link href={`/admin/projects/${t.project.id}`} className="hover:underline">
                              {t.project.clientName}
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-muted">{t.createdBy.name}</Td>
                        <Td className="whitespace-nowrap text-xs">{formatBjDate(t.dueAt)}</Td>
                        <Td className="whitespace-nowrap text-xs">{formatMinutes(t.estimatedMinutes)}</Td>
                        <Td>
                          <TaskStatusBadge task={t} now={now} />
                        </Td>
                        <Td className="text-xs">
                          {t.submissions.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {t.submissions.map((s) => (
                                <li key={s.id} className="max-w-64">
                                  {s.url && /^https?:\/\//i.test(s.url) ? (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                                      {s.url}
                                    </a>
                                  ) : s.url ? (
                                    <span className="break-all">{s.url}</span>
                                  ) : s.fileName ? (
                                    <a href={`/api/task-files/delivery/${s.id}`} className="break-all text-accent underline">
                                      {s.fileName}
                                    </a>
                                  ) : null}
                                  <span className="ml-1 text-muted">
                                    {s.fileSize ? `${fileSizeText(s.fileSize)} · ` : ""}
                                    {formatBj(s.submittedAt)}
                                  </span>
                                  {s.note ? <div className="text-muted">{s.note}</div> : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td>
                          <div className="flex gap-2">
                            <form action={setInternTaskStatus.bind(null, t.id, t.status === "DONE" ? "TODO" : "DONE")}>
                              <Button type="submit" variant="secondary" className="whitespace-nowrap px-2.5 py-1 text-xs">
                                {t.status === "DONE" ? "撤销完成" : "标为完成"}
                              </Button>
                            </form>
                            <form action={deleteInternTask.bind(null, t.id)}>
                              <Button type="submit" variant="ghost" className="px-2.5 py-1 text-xs text-red-700">
                                删除
                              </Button>
                            </form>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
