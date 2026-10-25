"use client";
import { upload } from "@vercel/blob/client";
import type { UploadPurpose } from "./upload-ticket";

/** Files bypass the function request body limit; only a signed reference reaches the action. */
export async function prepareFileUpload(formData: FormData, purpose: UploadPurpose, targetId: string) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return;
  const response = await fetch("/api/uploads/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, targetId, fileName: file.name, size: file.size, type: file.type }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "上传准备失败，请重试");
  if (!result.enabled) return;
  try {
    await upload(result.pathname, file, {
      access: "private", handleUploadUrl: "/api/uploads/token", clientPayload: result.ticket,
      multipart: file.size > 4 * 1024 * 1024,
    });
  } catch { throw new Error("文件上传失败，请检查网络后重试"); }
  formData.delete("file");
  formData.set("fileRef", result.ticket);
}
