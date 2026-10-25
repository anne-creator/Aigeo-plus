import { Alert, Badge, Button, Card, CardTitle, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, labelOf } from "@/lib/rules";
import { DUTY_ROLES } from "@/lib/tasks";
import { formatBj } from "@/lib/time";
import { one } from "../_lib";
import { createUser, resetPassword, toggleActive, updateUser } from "./actions";
import { CreateRoleFields, UserEditCells } from "./role-fields";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const saved = one(sp.saved);
  const session = await getSession();
  const users = await prisma.user.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: [{ role: "asc" }, { active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <PageHeader title="账号管理" description="密码只保存哈希，任何地方都不会显示；重置后请线下告知本人。渠道方账号登录入口：/partner" />
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
        <CardTitle>新建账号</CardTitle>
        <form action={createUser} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" autoComplete="off">
          <Field label="用户名" hint="3–32 位，字母/数字/._-">
            <Input name="username" required pattern="[a-zA-Z0-9._\-]{3,32}" autoComplete="off" />
          </Field>
          <Field label="姓名">
            <Input name="name" required maxLength={50} />
          </Field>
          <CreateRoleFields roles={ROLES} duties={DUTY_ROLES} />
          <Field label="初始密码" hint="至少 6 位">
            <Input name="password" type="password" minLength={6} required autoComplete="new-password" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              创建
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardTitle>全部账号（{users.length}）</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>用户名</Th>
              <Th>姓名 / 角色</Th>
              <Th>负责人类型</Th>
              <Th>渠道</Th>
              <Th>状态</Th>
              <Th>项目数</Th>
              <Th>创建时间</Th>
              <Th>重置密码</Th>
              <Th>启用/停用</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === session?.uid;
              return (
                <tr key={u.id}>
                  <Td className="whitespace-nowrap">
                    <span className="font-medium">{u.username}</span>
                    {self ? <Badge tone="blue" className="ml-2">我</Badge> : null}
                  </Td>
                  <UserEditCells
                    formId={`user-${u.id}`}
                    action={updateUser.bind(null, u.id)}
                    name={u.name}
                    role={u.role}
                    dutyRole={u.dutyRole}
                    channel={u.channel}
                    roles={ROLES}
                    duties={DUTY_ROLES}
                  />
                  <Td>{u.active ? <Badge tone="green">启用</Badge> : <Badge tone="zinc">已停用</Badge>}</Td>
                  <Td>{u.role === "PM" ? u._count.projects : <span className="text-muted">—</span>}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatBj(u.createdAt)}</Td>
                  <Td>
                    <form action={resetPassword.bind(null, u.id)} className="flex items-center gap-2" autoComplete="off">
                      <Input name="password" type="password" minLength={6} required placeholder="新密码" autoComplete="new-password" className="w-32" />
                      <Button type="submit" variant="secondary" className="px-2.5 py-1 text-xs">
                        重置
                      </Button>
                    </form>
                  </Td>
                  <Td>
                    <form action={toggleActive.bind(null, u.id)}>
                      <Button type="submit" variant={u.active ? "danger" : "secondary"} className="px-2.5 py-1 text-xs" disabled={self && u.active}>
                        {u.active ? "停用" : "启用"}
                      </Button>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-muted">角色：{ROLES.map((r) => `${labelOf(ROLES, r.value)}（${r.value}）`).join("、")}。停用后无法登录，历史提交与项目归属保留。</p>
      </Card>
    </>
  );
}
