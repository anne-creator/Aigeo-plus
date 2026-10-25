import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

export const uploadRequestSchema = z.object({
  purpose: z.enum(["timeline", "task-source", "task-delivery", "deliverable"]),
  targetId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  type: z.string().max(150),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type UploadPurpose = UploadRequest["purpose"];
const ticketSchema = uploadRequestSchema.extend({
  uid: z.string().min(1), pathname: z.string().regex(/^uploads\/[a-f0-9-]{36}\/[^/]+$/),
});
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("上传服务尚未配置");
  return new TextEncoder().encode(secret);
}
export async function issueUploadTicket(uid: string, input: UploadRequest) {
  const fileName = input.fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-120);
  const pathname = `uploads/${randomUUID()}/${fileName}`;
  const ticket = await new SignJWT({ ...input, fileName, uid, pathname })
    .setProtectedHeader({ alg: "HS256" }).setAudience("file-upload").setIssuedAt().setExpirationTime("1h").sign(key());
  return { ticket, pathname };
}
export async function verifyUploadTicket(ticket: string, uid: string, expected?: { purpose: UploadPurpose; targetId: string }) {
  try {
    const { payload } = await jwtVerify(ticket, key(), { algorithms: ["HS256"], audience: "file-upload" });
    const data = ticketSchema.parse(payload);
    if (data.uid !== uid || (expected && (data.purpose !== expected.purpose || data.targetId !== expected.targetId))) throw new Error();
    return data;
  } catch { throw new Error("文件凭证无效或已过期，请重新选择文件上传"); }
}
