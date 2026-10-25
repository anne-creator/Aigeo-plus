import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/** 只初始化空数据库，不清空数据，也不重置已有账号密码。 */
export async function bootstrapAdmin(env = process.env) {
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.count()) {
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
      if (!admin) throw new Error("已有数据库中没有启用的管理员，请先恢复管理员账号。");
      return { created: false };
    }
    const password = env.BOOTSTRAP_ADMIN_PASSWORD || "";
    if (password.length < 16 || password.startsWith("replace-with")) throw new Error("首次启动需配置至少 16 位的 BOOTSTRAP_ADMIN_PASSWORD。");
    const username = env.BOOTSTRAP_ADMIN_USERNAME?.trim() || "admin";
    await prisma.user.create({ data: {
      username, name: "管理员", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12),
    } });
    return { created: true };
  } finally { await prisma.$disconnect(); }
}
