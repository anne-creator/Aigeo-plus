import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`初始化步骤失败（退出码 ${code}）`)));
  });
}

try {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32 || /dev-secret|replace-with/i.test(secret)) throw new Error("生产环境需要独立的随机 SESSION_SECRET，至少 32 位。");
  if (!process.env.DATABASE_URL?.startsWith("file:/")) throw new Error("此部署包使用 SQLite，请将 DATABASE_URL 配置为持久磁盘上的绝对路径，例如 file:/data/aigeo.db。");
  if (!path.isAbsolute(process.env.UPLOAD_DIR || "")) throw new Error("UPLOAD_DIR 必须配置为持久磁盘上的绝对路径。");
  await mkdir(path.dirname(process.env.DATABASE_URL.slice(5)), { recursive: true });
  const database = await open(process.env.DATABASE_URL.slice(5), "a", 0o600);
  await database.close();
  await mkdir(process.env.UPLOAD_DIR, { recursive: true });
  // 不使用 reset、seed、accept-data-loss；遇到潜在数据丢失时启动会停止。
  await run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]);
  const result = await bootstrapAdmin();
  console.log(result.created ? "正式管理员账号已创建。" : "已保留现有数据库和账号。");
  const child = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("应用服务启动失败。"); process.exit(1); });
  child.on("exit", (code) => process.exit(code ?? 1));
} catch (error) {
  console.error(error instanceof Error ? error.message : "生产初始化失败。");
  process.exitCode = 1;
}
