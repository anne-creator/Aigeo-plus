import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// SQLite stays the local default. Production derives PostgreSQL from the same models.
export async function productionSchema() {
  const schema = (await readFile("prisma/schema.prisma", "utf8")).replace('provider = "sqlite"', 'provider = "postgresql"');
  if (!schema.includes('provider = "postgresql"')) throw new Error("无法生成 PostgreSQL schema");
  const file = "prisma/schema.production.prisma";
  await writeFile(file, schema);
  return file;
}
export function prismaCommand(args, env = process.env) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { stdio: "inherit", env });
  if (result.status !== 0) throw new Error("Prisma 命令失败");
}
if (process.argv[1]?.endsWith("prisma-generate.mjs")) {
  const schema = process.env.VERCEL || /^postgres(ql)?:/.test(process.env.DATABASE_URL || "")
    ? await productionSchema() : "prisma/schema.prisma";
  prismaCommand(["generate", "--schema", schema]);
}
