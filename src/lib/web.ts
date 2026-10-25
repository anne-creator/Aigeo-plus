/** 客户官网：选填，不要求 http(s):// 开头；显示成链接时自动补全。客户端也可引用。 */
import { z } from "zod";

/** 选填；填了就去掉首尾空格，不能含空格、不超过 300 字 */
export const websiteSchema = z
  .string()
  .trim()
  .max(300, "官网地址过长")
  .refine((s) => !/\s/.test(s), "官网地址里不能有空格");

/** acme.com → https://acme.com；已带协议的原样；空则 null */
export function websiteHref(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
