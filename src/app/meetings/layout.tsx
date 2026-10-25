import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { requireSession } from "@/lib/auth";
import { getCalendarData } from "@/lib/calendar";

/** 会议页对管理员、项目经理、负责人开放，导航沿用各自的端 */
export default async function Layout({ children }: { children: ReactNode }) {
  const session = await requireSession(["PM", "INTERN"]);
  const calendar = await getCalendarData(session);
  return (
    <AppShell session={session} portal={session.role} sidebar={<CalendarSidebar data={calendar} role={session.role} />}>
      {children}
    </AppShell>
  );
}
