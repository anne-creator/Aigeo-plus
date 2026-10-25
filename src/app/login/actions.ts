"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, getSession, homeFor, verifyCredentials } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // 渠道方登录页（/partner）提交时带 from=partner，出错回到渠道方登录页
  const fromPartner = formData.get("from") === "partner";
  const session = await verifyCredentials(username, password);
  if (!session) redirect(fromPartner ? "/partner?error=1" : "/login?error=1");
  await createSession(session);
  redirect(homeFor(session.role));
}

export async function logoutAction(): Promise<void> {
  const s = await getSession();
  await clearSession();
  redirect(s?.role === "CHANNEL" ? "/partner" : "/login");
}
