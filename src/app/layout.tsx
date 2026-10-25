import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aigeo+ · 项目考核系统",
  description: "Aigeo+ 内部考核系统：项目交付节点、日历 checklist、延期扣分与季度 KPI 奖测算",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
