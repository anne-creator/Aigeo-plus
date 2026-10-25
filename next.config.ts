import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  outputFileTracingExcludes: {
    "/*": ["./uploads/**/*", "./tmp/**/*", "./prisma/*.db*", "./deploy/private/**/*"],
  },
  // 内部业务系统：所有页面按请求动态渲染，不启用 Cache Components。
  cacheComponents: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
