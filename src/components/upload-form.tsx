"use client";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { prepareFileUpload } from "@/lib/upload-client";
import type { UploadPurpose } from "@/lib/upload-ticket";

function Fields({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className={className}>{children}{pending ? <p role="status" className="text-sm text-muted">正在上传并处理，请稍候…</p> : null}</fieldset>;
}

export function UploadForm({ action, purpose, targetId, targetField = "projectId", children, className }: {
  action: string | ((formData: FormData) => Promise<void>); purpose: UploadPurpose;
  targetId?: string; targetField?: string; children: ReactNode; className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setError(null);
    try {
      await prepareFileUpload(formData, purpose, targetId || String(formData.get(targetField) || ""));
      if (typeof action === "function") await action(formData);
      else {
        const response = await fetch(action, { method: "POST", body: formData });
        if (!response.ok) throw new Error("提交失败，请重试");
        if (new URL(response.url).origin !== location.origin) throw new Error("跳转地址无效");
        location.assign(response.url);
      }
    } catch (e) {
      unstable_rethrow(e);
      setError(e instanceof Error ? e.message : "提交失败，请重试");
    }
  }
  return <form action={submit}><Fields className={className}>{children}</Fields>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}</form>;
}
