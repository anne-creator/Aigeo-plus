import { productionSchema, prismaCommand } from "../scripts/prisma-generate.mjs";
import { spawnSync } from "node:child_process";

if (!/^postgres(ql)?:/.test(process.env.DATABASE_URL || "")) throw new Error("Vercel 需要 PostgreSQL DATABASE_URL");
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET 必须至少 32 位");
if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new Error("请先连接私有 Blob 存储");

const schema = await productionSchema();
prismaCommand(["generate", "--schema", schema]);
// Refuse destructive changes. Use the non-pooler connection for schema operations when available.
prismaCommand(["db", "push", "--skip-generate", "--schema", schema], {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL,
});
const { bootstrapAdmin } = await import("./bootstrap-admin.mjs");
const result = await bootstrapAdmin();
console.log(result.created ? "正式管理员已初始化。" : "保留已有管理员和业务数据。");
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status || 1);
