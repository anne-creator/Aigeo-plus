import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";
import { loginAction } from "../login/actions";

export const metadata: Metadata = {
  title: "Aigeo+ · 渠道合作伙伴登录",
  description: "查看您推荐给 Aigeo+ 的客户进度",
};

/** 渠道方专用登录页：与 /login 共用登录逻辑，出错回到本页 */
export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { error } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-white to-[#f1f3f8] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Partner</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Aigeo+ 渠道合作伙伴登录</h1>
          <p className="mt-1.5 text-sm text-muted">查看您推荐给 Aigeo+ 的客户进度</p>
          <form action={loginAction} className="mt-7 space-y-4">
            <input type="hidden" name="from" value="partner" />
            <Field label="账号">
              <Input name="username" autoComplete="username" required autoFocus />
            </Field>
            <Field label="密码">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            {error ? <p className="text-sm text-amber-700">账号或密码不正确，或账号已停用。</p> : null}
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted">账号由 Aigeo+ 为您开通；如需帮助请联系您的对接人。</p>
      </div>
    </div>
  );
}
