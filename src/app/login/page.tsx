import { redirect } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { error } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Aigeo+</h1>
        <p className="text-sm font-medium text-foreground/80">项目考核系统</p>
        <p className="mt-1 text-sm text-muted">请使用公司分配的账号登录。</p>
        <form action={loginAction} className="mt-6 space-y-4">
          <Field label="用户名">
            <Input name="username" autoComplete="username" required autoFocus />
          </Field>
          <Field label="密码">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {error ? <p className="text-sm text-red-600">用户名或密码不正确，或账号已停用。</p> : null}
          <Button type="submit" className="w-full">
            登录
          </Button>
        </form>
      </div>
    </div>
  );
}
