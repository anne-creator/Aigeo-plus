import "server-only";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export type Role = "ADMIN" | "PM" | "INTERN" | "CHANNEL";
export interface Session {
  uid: string;
  role: Role;
  name: string;
  username: string;
  /** 渠道方账号的渠道代码 */
  channel?: string | null;
}

const COOKIE = "geo_session";
const ROLE_VALUES: readonly string[] = ["ADMIN", "PM", "INTERN", "CHANNEL"];

/** 会话签名密钥：生产环境必须配置 SESSION_SECRET（≥ 32 位），否则拒绝签发/校验会话 */
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32)) {
    throw new Error("SESSION_SECRET 未设置或少于 32 位：生产环境必须配置一个随机长密钥");
  }
  return new TextEncoder().encode(s || "geo-kpi-dev-secret");
};

export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * 当前会话。令牌只用来识别用户，角色/姓名/是否停用每次都以数据库为准：
 * 管理员停用账号或改角色后立即生效，不用等 7 天令牌过期。每个请求内只查一次。
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      select: { id: true, role: true, name: true, username: true, active: true, channel: true },
    });
    if (!user || !user.active || !ROLE_VALUES.includes(user.role)) return null;
    return { uid: user.id, role: user.role as Role, name: user.name, username: user.username, channel: user.channel };
  } catch {
    return null;
  }
});

/** 各角色登录后的首页 */
export function homeFor(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "PM") return "/pm";
  if (role === "CHANNEL") return "/channel";
  return "/intern";
}

/**
 * 页面/布局里调用：未登录跳转登录页；角色不符跳回自己的首页。
 * ADMIN 可以进入所有端口。
 */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (roles && !roles.includes(s.role) && s.role !== "ADMIN") redirect(homeFor(s.role));
  return s;
}

/** 校验用户名密码，成功返回 Session */
export async function verifyCredentials(username: string, password: string): Promise<Session | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { uid: user.id, role: user.role as Role, name: user.name, username: user.username };
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

/** 当前用户是否能操作该项目：ADMIN 或项目的 PM */
export function canAccessProject(s: Session, project: { pmId: string }): boolean {
  return s.role === "ADMIN" || project.pmId === s.uid;
}
