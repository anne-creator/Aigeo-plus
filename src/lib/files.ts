import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import path from "node:path";
import { get, head, put, del } from "@vercel/blob";
import { verifyUploadTicket, type UploadPurpose } from "./upload-ticket";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
type StoredFile = { relPath: string; fileName: string; size: number };
const uploadedFiles = new WeakMap<File, StoredFile>();
export const cloudStorageEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export function uploadRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "./uploads");
}

function safeName(name: string): string {
  const base = path.basename(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-120);
  return base || "file";
}

/** 保存上传文件，返回相对 uploads 根目录的路径 */
export async function saveUpload(file: File, subdir: string): Promise<{ relPath: string; fileName: string; size: number }> {
  if (file.size <= 0) throw new Error("文件为空");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("文件超过 50MB");
  const uploaded = uploadedFiles.get(file);
  if (uploaded) return uploaded;
  const fileName = safeName(file.name);
  const rel = path.join(subdir.replace(/[^a-zA-Z0-9_-]/g, "_"), `${randomUUID()}-${fileName}`);
  if (cloudStorageEnabled()) {
    const blob = await put(rel, file, { access: "private", addRandomSuffix: false });
    return { relPath: `blob:${blob.pathname}`, fileName, size: file.size };
  }
  if (process.env.VERCEL) throw new Error("云存储尚未配置，请联系管理员");
  const abs = path.join(/*turbopackIgnore: true*/ uploadRoot(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { relPath: rel, fileName, size: file.size };
}

export function absolutePathOf(relPath: string): string {
  const abs = path.resolve(/*turbopackIgnore: true*/ uploadRoot(), relPath);
  if (!abs.startsWith(uploadRoot() + path.sep)) throw new Error("非法路径");
  return abs;
}

/** Only server-signed, user- and destination-bound references may be resolved. Never fetch a submitted URL. */
export async function fileFromForm(form: FormData, uid: string, purpose: UploadPurpose, targetId: string): Promise<File | null> {
  const ref = form.get("fileRef");
  if (ref) {
    if (typeof ref !== "string") throw new Error("文件凭证无效");
    const data = await verifyUploadTicket(ref, uid, { purpose, targetId });
    try {
      const meta = await head(data.pathname);
      if (meta.pathname !== data.pathname || meta.size !== data.size || meta.size > MAX_UPLOAD_BYTES) throw new Error();
      const result = await get(data.pathname, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) throw new Error();
      const buffer = await new Response(result.stream).arrayBuffer();
      if (buffer.byteLength !== data.size) throw new Error();
      const file = new File([buffer], data.fileName, { type: data.type || meta.contentType });
      uploadedFiles.set(file, { relPath: `blob:${data.pathname}`, fileName: data.fileName, size: data.size });
      return file;
    } catch { throw new Error("未找到完整文件，请重新上传"); }
  }
  const file = form.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

/** Only used for a temporary timeline source after extraction, never for saved deliverables. */
export async function discardImportedFile(file: File) {
  const stored = uploadedFiles.get(file);
  if (stored?.relPath.startsWith("blob:")) await del(stored.relPath.slice(5));
}

export async function storedFileStream(relPath: string): Promise<ReadableStream> {
  if (relPath.startsWith("blob:")) {
    const result = await get(relPath.slice(5), { access: "private" });
    if (!result || result.statusCode !== 200) throw new Error("文件不存在");
    return result.stream;
  }
  const abs = absolutePathOf(relPath);
  await stat(abs);
  return Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream;
}

export async function readStoredFile(relPath: string): Promise<Buffer> {
  if (!relPath.startsWith("blob:")) return readFile(absolutePathOf(relPath));
  return Buffer.from(await new Response(await storedFileStream(relPath)).arrayBuffer());
}
