import { readdir, rm } from "node:fs/promises";
import path from "node:path";

// Next standalone 会复制构建环境的 .env；发布物只接受运行时注入的密钥。
const root = path.resolve(".next/standalone");
const entries = await readdir(root).catch(() => []);
for (const entry of entries) {
  if (entry.startsWith(".env") || entry === "uploads" || entry === "tmp") {
    await rm(path.join(root, entry), { recursive: true, force: true });
  }
}
await rm(path.join(root, "deploy/private"), { recursive: true, force: true });
const prismaFiles = await readdir(path.join(root, "prisma")).catch(() => []);
for (const name of prismaFiles) {
  if (/\.db(?:-|$)/.test(name)) await rm(path.join(root, "prisma", name), { force: true });
}
console.log("Standalone package excludes local secrets, databases, and uploads.");
