import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession, requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Aigeo+ · 渠道合作伙伴",
  description: "查看您推荐给 Aigeo+ 的客户进度、计划与交付物",
};

/** 渠道方端口：只有「我的客户」，不显示日历 */
export default async function ChannelLayout({ children }: { children: ReactNode }) {
  // 未登录的渠道方回到渠道方登录页（而不是内部登录页）
  if (!(await getSession())) redirect("/partner");
  const session = await requireSession(["CHANNEL"]);
  return (
    <AppShell session={session} portal="CHANNEL">
      {children}
    </AppShell>
  );
}
