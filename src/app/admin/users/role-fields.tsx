"use client";

import { useState } from "react";
import { Button, Field, Input, Select, Td } from "@/components/ui";
import { CHANNELS } from "@/lib/channels";

/** 选项由服务端传入（@/lib/tasks 依赖数据库，不能进客户端包） */
export type Opt = { value: string; label: string };

function RoleOptions({ roles }: { roles: readonly Opt[] }) {
  return roles.map((r) => (
    <option key={r.value} value={r.value}>
      {r.label}
    </option>
  ));
}

function DutyOptions({ duties }: { duties: readonly Opt[] }) {
  return (
    <>
      <option value="" disabled>
        请选择
      </option>
      {duties.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </>
  );
}

function ChannelOptions() {
  return (
    <>
      <option value="" disabled>
        请选择渠道
      </option>
      {CHANNELS.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </>
  );
}

/** 新建账号：角色 + 负责人类型（仅负责人必填）/ 渠道（仅渠道方必填），共用一格 */
export function CreateRoleFields({ roles, duties }: { roles: readonly Opt[]; duties: readonly Opt[] }) {
  const [role, setRole] = useState("PM");
  return (
    <>
      <Field label="角色">
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value)} required>
          <RoleOptions roles={roles} />
        </Select>
      </Field>
      <Field label={role === "CHANNEL" ? "渠道" : "负责人类型"}>
        {role === "INTERN" ? (
          <Select key="duty" name="dutyRole" required defaultValue="">
            <DutyOptions duties={duties} />
          </Select>
        ) : role === "CHANNEL" ? (
          <Select key="channel" name="channel" required defaultValue="">
            <ChannelOptions />
          </Select>
        ) : (
          <Select key="none" disabled defaultValue="" aria-label="负责人类型">
            <option value="">—</option>
          </Select>
        )}
      </Field>
    </>
  );
}

/** 账号列表里的一行编辑：姓名 / 角色 一格，负责人类型 一格，渠道 一格（同一个表单） */
export function UserEditCells({
  formId,
  action,
  name,
  role: initialRole,
  dutyRole,
  channel,
  roles,
  duties,
}: {
  roles: readonly Opt[];
  duties: readonly Opt[];
  formId: string;
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  role: string;
  dutyRole: string | null;
  channel: string | null;
}) {
  const [role, setRole] = useState(initialRole);
  return (
    <>
      <Td>
        <form id={formId} action={action} className="flex flex-wrap items-center gap-2">
          <Input name="name" defaultValue={name} required maxLength={50} className="w-32" />
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-28">
            <RoleOptions roles={roles} />
          </Select>
          <Button type="submit" variant="secondary" className="px-2.5 py-1 text-xs">
            保存
          </Button>
        </form>
      </Td>
      <Td>
        {role === "INTERN" ? (
          <Select name="dutyRole" form={formId} required defaultValue={dutyRole ?? ""} className="w-44">
            <DutyOptions duties={duties} />
          </Select>
        ) : (
          <span className="text-muted">—</span>
        )}
      </Td>
      <Td>
        {role === "CHANNEL" ? (
          <Select name="channel" form={formId} required defaultValue={channel ?? ""} className="w-32">
            <ChannelOptions />
          </Select>
        ) : (
          <span className="text-muted">—</span>
        )}
      </Td>
    </>
  );
}
