import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { requireSession } from "@/lib/auth";
import { getCalendarData } from "@/lib/calendar";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await requireSession(["PM"]);
  const calendar = await getCalendarData(session);
  return (
    <AppShell session={session} portal="PM" sidebar={<CalendarSidebar data={calendar} role={session.role} />}>
      {children}
    </AppShell>
  );
}
