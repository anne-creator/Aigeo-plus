import { Alert, Button, Card, Field, Input, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MEETING_DURATIONS } from "@/lib/meetings";
import { dutyRoleLabel } from "@/lib/tasks";
import { toBjYmd } from "@/lib/time";
import { createMeetingAction } from "../actions";
import { ParticipantPicker, type PickerGroup } from "./participant-picker";

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(["PM"]);
  const q = await searchParams;
  const error = typeof q.error === "string" ? q.error : "";
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "PM", "INTERN"] }, id: { not: session.uid } },
    select: { id: true, name: true, role: true, dutyRole: true },
    orderBy: { name: "asc" },
  });
  const groups: PickerGroup[] = [
    { key: "ADMIN", label: "管理员", people: users.filter((u) => u.role === "ADMIN").map((u) => ({ id: u.id, name: u.name })) },
    { key: "PM", label: "项目经理", people: users.filter((u) => u.role === "PM").map((u) => ({ id: u.id, name: u.name })) },
    {
      key: "INTERN",
      label: "负责人",
      people: users.filter((u) => u.role === "INTERN").map((u) => ({ id: u.id, name: u.name, hint: u.dutyRole ? dutyRoleLabel(u.dutyRole) : undefined })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="发起会议"
        description="选时间、写目的、选参会人；所有人同意后自动进入每个人的日历"
        actions={
          <LinkButton href="/meetings" variant="secondary">
            返回
          </LinkButton>
        }
      />
      {error ? <Alert tone="red">{error}</Alert> : null}
      <form action={createMeetingAction} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="会议目的">
                <Input name="title" required maxLength={200} placeholder="例如：Acme 月度复盘与下月计划对齐" />
              </Field>
            </div>
            <Field label="日期">
              <Input name="date" type="date" required defaultValue={toBjYmd(new Date())} />
            </Field>
            <Field label="开始时间" hint="北京时间">
              <Input name="time" type="time" required step={300} defaultValue="14:00" />
            </Field>
            <Field label="时长">
              <Select name="duration" defaultValue="30">
                {MEETING_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} 分钟` : m % 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m / 60} 小时`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="地点 / 会议链接（选填）">
              <Input name="location" maxLength={300} placeholder="会议室 A 或腾讯会议链接" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="备注（选填）">
                <Textarea name="note" maxLength={2000} className="min-h-16" placeholder="议程、需要提前准备的材料" />
              </Field>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">参会人员</h2>
          <ParticipantPicker groups={groups} />
        </Card>
        <div className="flex justify-end">
          <Button type="submit" className="px-6 py-2.5">
            发送会议请求
          </Button>
        </div>
      </form>
    </div>
  );
}
