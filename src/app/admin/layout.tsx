import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { Alert } from "@/components/ui";
import { homeFor, requireSession, type Role } from "@/lib/auth";
import { getCalendarData } from "@/lib/calendar";
import { accountState } from "./_lib";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await requireSession(["ADMIN"]);
  // 令牌里的角色/状态可能已过期：按数据库现状复核（被降级→回自己的首页；已停用→只给退出入口）
  const acct = await accountState(session.uid);
  if (acct && acct.active && acct.role !== "ADMIN") redirect(homeFor(acct.role as Role));
  const disabled = !acct || !acct.active;
  const calendar = disabled ? null : await getCalendarData(session);
  return (
    <AppShell session={session} portal="ADMIN" sidebar={calendar ? <CalendarSidebar data={calendar} role={session.role} /> : undefined}>
      {disabled ? <Alert tone="red">账号已停用，请退出登录。</Alert> : children}
    </AppShell>
  );
}
