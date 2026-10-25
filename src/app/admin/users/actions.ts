"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { CHANNEL_VALUES } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/rules";
import { DUTY_ROLE_VALUES } from "@/lib/tasks";
import { failTo, firstIssue, requireAdmin, str, withQuery } from "../_lib";

const BACK = "/admin/users";
const roleSchema = z.enum(
  ROLES.map((r) => r.value),
  { error: "请选择角色" },
);
const dutyRoleSchema = z.enum(DUTY_ROLE_VALUES, { error: "请选择负责人类型" });
const passwordSchema = z.string().min(6, "密码至少 6 位").max(72, "密码过长");

/** 负责人（INTERN）必须有类型；其他角色清空 */
function resolveDutyRole(role: string, formData: FormData): string | null {
  if (role !== "INTERN") return null;
  const parsed = dutyRoleSchema.safeParse(str(formData, "dutyRole"));
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  return parsed.data;
}

const channelSchema = z.enum(CHANNEL_VALUES, { error: "渠道方账号请选择渠道" });

/** 渠道方（CHANNEL）必须选渠道；其他角色清空 */
function resolveChannel(role: string, formData: FormData): string | null {
  if (role !== "CHANNEL") return null;
  const parsed = channelSchema.safeParse(str(formData, "channel"));
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  return parsed.data;
}

function done(): never {
  revalidatePath("/", "layout");
  redirect(withQuery(BACK, { saved: 1 }));
}

export async function createUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      username: z.string().regex(/^[a-zA-Z0-9._-]{3,32}$/, "用户名须为 3–32 位字母、数字、点、下划线或连字符"),
      name: z.string().trim().min(1, "姓名必填").max(50, "姓名过长"),
      role: roleSchema,
      password: passwordSchema,
    })
    .safeParse({
      username: str(formData, "username"),
      name: str(formData, "name"),
      role: str(formData, "role"),
      password: String(formData.get("password") ?? ""),
    });
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const v = parsed.data;
  const dup = await prisma.user.findUnique({ where: { username: v.username }, select: { id: true } });
  if (dup) failTo(BACK, `用户名 ${v.username} 已存在`);
  const dutyRole = resolveDutyRole(v.role, formData);
  const channel = resolveChannel(v.role, formData);
  await prisma.user.create({
    data: { username: v.username, name: v.name, role: v.role, dutyRole, channel, passwordHash: await hashPassword(v.password) },
  });
  done();
}

export async function updateUser(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const parsed = z
    .object({ name: z.string().trim().min(1, "姓名必填").max(50, "姓名过长"), role: roleSchema })
    .safeParse({ name: str(formData, "name"), role: str(formData, "role") });
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) failTo(BACK, "账号不存在");
  if (id === session.uid && parsed.data.role !== "ADMIN") failTo(BACK, "不能把自己的角色改为非管理员");
  const dutyRole = resolveDutyRole(parsed.data.role, formData);
  const channel = resolveChannel(parsed.data.role, formData);
  await prisma.user.update({ where: { id }, data: { ...parsed.data, dutyRole, channel } });
  done();
}

export async function toggleActive(id: string): Promise<void> {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) failTo(BACK, "账号不存在");
  if (id === session.uid && user.active) failTo(BACK, "不能停用自己的账号");
  await prisma.user.update({ where: { id }, data: { active: !user.active } });
  done();
}

export async function resetPassword(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!parsed.success) failTo(BACK, firstIssue(parsed.error));
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) failTo(BACK, "账号不存在");
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(parsed.data) } });
  done();
}
