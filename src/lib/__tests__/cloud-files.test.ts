import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { issueUploadTicket, verifyUploadTicket } from "../upload-ticket";
import { fileFromForm, saveUpload, discardImportedFile, storedFileStream } from "../files";

const blob = vi.hoisted(() => ({ head: vi.fn(), get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);
const secret = "test-only-upload-secret-0123456789abcdef";
const input = { purpose: "timeline" as const, targetId: "project-1", fileName: "计划.txt", size: 3, type: "text/plain" };
beforeEach(() => { vi.stubEnv("SESSION_SECRET", secret); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test"); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

it("文件凭证绑定用户、用途和目标项目；不能篡改或跨用途重用", async () => {
  const { ticket } = await issueUploadTicket("pm-1", input);
  expect((await verifyUploadTicket(ticket, "pm-1", input)).fileName).toBe("计划.txt");
  await expect(verifyUploadTicket(ticket, "pm-2", input)).rejects.toThrow("无效");
  await expect(verifyUploadTicket(ticket, "pm-1", { ...input, targetId: "project-2" })).rejects.toThrow("无效");
  await expect(verifyUploadTicket(ticket, "pm-1", { ...input, purpose: "deliverable" })).rejects.toThrow("无效");
  await expect(verifyUploadTicket(ticket + "tampered", "pm-1", input)).rejects.toThrow("无效");
});
it("过期凭证和非上传用途 JWT 均拒绝", async () => {
  const { ticket } = await issueUploadTicket("pm-1", input);
  const data = await verifyUploadTicket(ticket, "pm-1");
  for (const audience of ["file-upload", "session"]) {
    const expired = await new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setAudience(audience)
      .setExpirationTime(audience === "file-upload" ? "0s" : "1h").sign(new TextEncoder().encode(secret));
    await expect(verifyUploadTicket(expired, "pm-1")).rejects.toThrow("过期");
  }
});
it("任意 URL 或他人凭证不会触发存储读取", async () => {
  const form = new FormData(); form.set("fileRef", "http://127.0.0.1/private");
  await expect(fileFromForm(form, "pm-1", "timeline", "project-1")).rejects.toThrow("无效");
  const { ticket } = await issueUploadTicket("pm-2", input); form.set("fileRef", ticket);
  await expect(fileFromForm(form, "pm-1", "timeline", "project-1")).rejects.toThrow("无效");
  expect(blob.head).not.toHaveBeenCalled(); expect(blob.get).not.toHaveBeenCalled();
});
it("按存储实际大小验证上传，保存时引用现有私有文件而不重复上传", async () => {
  const { ticket, pathname } = await issueUploadTicket("pm-1", input);
  const form = new FormData(); form.set("fileRef", ticket);
  blob.head.mockResolvedValue({ pathname, size: 3, contentType: "text/plain" });
  blob.get.mockImplementation(async () => ({ statusCode: 200, stream: new Response("abc").body }));
  const file = await fileFromForm(form, "pm-1", "timeline", "project-1");
  expect(await file!.text()).toBe("abc");
  expect(await saveUpload(file!, "test")).toEqual({ relPath: `blob:${pathname}`, fileName: input.fileName, size: 3 });
  expect(blob.put).not.toHaveBeenCalled();
  expect(await new Response(await storedFileStream(`blob:${pathname}`)).text()).toBe("abc");
  await discardImportedFile(file!); expect(blob.del).toHaveBeenCalledWith(pathname);
  blob.head.mockResolvedValue({ pathname, size: 4 });
  await expect(fileFromForm(form, "pm-1", "timeline", "project-1")).rejects.toThrow("完整文件");
});
it("普通文件在云端保存为私有 Blob，未配云存储时拒绝写 Vercel 临时磁盘", async () => {
  const file = new File(["abc"], "a.txt", { type: "text/plain" });
  blob.put.mockResolvedValue({ pathname: "private/file" });
  expect((await saveUpload(file, "test")).relPath).toBe("blob:private/file");
  expect(blob.put.mock.calls[0][2].access).toBe("private");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("BLOB_STORE_ID", ""); vi.stubEnv("VERCEL", "1");
  await expect(saveUpload(file, "test")).rejects.toThrow("云存储尚未配置");
});
