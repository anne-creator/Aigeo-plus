import Link from "next/link";
import type { ReactNode } from "react";
import type { Role, Session } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

const NAV: Record<Role, Array<{ href: string; label: string }>> = {
  PM: [
    { href: "/pm", label: "待办与提醒" },
    { href: "/pm/projects", label: "我的项目" },
    { href: "/pm/pay", label: "我的收入" },
    { href: "/pm/tasks", label: "分配任务" },
    { href: "/meetings", label: "会议" },
    { href: "/pm/projects/new", label: "新建客户档案" },
  ],
  ADMIN: [
    { href: "/admin", label: "总览" },
    { href: "/admin/projects", label: "全部项目" },
    { href: "/admin/pay", label: "薪酬与绩效" },
    { href: "/admin/reviews", label: "材料审核" },
    { href: "/admin/users", label: "账号管理" },
    { href: "/admin/interns", label: "负责人任务" },
    { href: "/meetings", label: "会议" },
    { href: "/admin/settings", label: "系统设置" },
  ],
  CHANNEL: [{ href: "/channel", label: "我的客户" }],
  INTERN: [
    { href: "/intern", label: "我的任务" },
    { href: "/intern/work", label: "我的工时" },
    { href: "/intern/knowledge", label: "客户知识库" },
    { href: "/meetings", label: "会议" },
  ],
};

const ROLE_LABEL: Record<Role, string> = { ADMIN: "管理员", PM: "项目经理", INTERN: "负责人", CHANNEL: "渠道方" };

export function AppShell({
  session,
  portal,
  sidebar,
  children,
}: {
  session: Session;
  portal: Role;
  /** 右侧个人日历；lg 以上与主内容并排，小屏排在主内容下方 */
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  const links = NAV[portal];
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Aigeo+
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href as never} className="rounded-md px-2.5 py-1.5 text-foreground/80 hover:bg-zinc-100 hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {session.role === "ADMIN" && portal !== "ADMIN" ? (
              <Link href="/admin" className="text-xs text-muted underline">
                返回管理端
              </Link>
            ) : null}
            <span className="text-muted">
              {session.name} · {ROLE_LABEL[session.role]}
            </span>
            <form action={logoutAction}>
              <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-zinc-50">退出</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 lg:flex-row lg:items-start lg:gap-6">
        <main className="w-full min-w-0 flex-1">{children}</main>
        {sidebar ? (
          <aside className="mt-8 w-full lg:sticky lg:top-4 lg:mt-0 lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto">{sidebar}</aside>
        ) : null}
      </div>
    </div>
  );
}
