# 部署

## Vercel + Neon PostgreSQL + 私有 Blob

正式环境采用 PostgreSQL 存储业务数据、私有 Vercel Blob 存储附件。本地继续使用 SQLite 和 uploads 目录，两个环境的数据相互独立。

1. 创建并链接独立的 Vercel 项目，Node.js 选择 24.x。
2. 在 Marketplace 接入 Neon，创建数据库并连接 Production 环境。首次接入须由账号持有人确认服务条款。
3. 创建同区域的 **Private** Blob store 并连接 Production 环境。
4. 配置 Production 环境变量：`DATABASE_URL`（Neon 自动注入）、`BLOB_READ_WRITE_TOKEN`（Blob 自动注入）、独立随机 `SESSION_SECRET`（至少 32 位）、`BOOTSTRAP_ADMIN_USERNAME`、随机 `BOOTSTRAP_ADMIN_PASSWORD`（至少 16 位）、`OPENAI_API_KEY`、`OPENAI_MODEL=gpt-5.6-sol`。密码、会话密钥和 API Key 用 Secret 类型保存。
5. 执行 `vercel deploy --prod`。`vercel.json` 会调用专用构建脚本，生成 PostgreSQL Prisma Client、同步数据库结构、只在空库创建管理员，再构建网站。不会导入本地演示数据，不会清空数据库或重置密码；可能丢失数据的结构变更会阻止部署。

文件从浏览器直接上传私有 Blob，绕开函数请求体限制；timeline 保留 15 MB 上限，其他附件保留 50 MB 上限。上传凭证绑定账号、项目/任务和用途，1 小时过期；上传令牌有效 15 分钟。所有下载仍执行项目权限或客户分享令牌检查。临时 timeline 原文件提取后删除，候选条目经项目经理确认才发布；已保存的交付物保留在私有存储中。

发布后检查 `/api/health`、管理员登录、系统设置里的 OpenAI 连接、文件上传及下载。后续部署保留 PostgreSQL 和 Blob 数据。生产密钥放在 Vercel 环境变量中，不能写入源码或 `NEXT_PUBLIC_*`。`.vercelignore` 排除本地密钥、数据库、附件和私有部署文件。

## Docker 云服务器（备用）

适用于单实例 Node.js / Docker 云服务器。SQLite 数据库和上传文件都保存在持久磁盘；当前方案不用于 Vercel 等无持久磁盘的函数环境。

## 生产配置

1. 准备可通过 SSH 管理、安装了 Docker Compose 的 Linux 服务器，将域名解析到该服务器，开放 80/443。
2. 把项目源码上传到独立目录，例如 `/opt/aigeo-plus`。不要上传本地 `.env`、测试数据库或 `node_modules`。
3. 在项目的 `deploy/private/production.env` 写入 `production.env.example` 中的配置。`SESSION_SECRET` 使用独立随机值；管理员初始密码至少 16 位。OpenAI 模型为 `gpt-5.6-sol`。该文件权限设为 `600`，不提交到版本库。
4. 在项目根目录运行：

```sh
APP_DOMAIN=your-domain.example docker compose -f deploy/compose.yaml up -d --build
```

镜像构建时不会包含密钥、数据库或上传文件。运行时应用使用 Docker 的 `app_data` 卷保存 `/data/aigeo.db` 和 `/data/uploads`。Caddy 自动申请 HTTPS 证书，应用端口仅在容器网络内开放。生产会话使用安全 Cookie，必须通过 HTTPS 登录。

首次启动仅在空数据库创建管理员；不写入演示项目，不运行 seed 或 reset。每次启动使用 Prisma 同步 schema，遇到可能丢失数据的变更会停止，不自动接受数据丢失。已有账号、密码和项目保持原样。

## 验证和运维

```sh
APP_DOMAIN=your-domain.example docker compose -f deploy/compose.yaml ps
APP_DOMAIN=your-domain.example docker compose -f deploy/compose.yaml logs --tail=100 app
curl --fail https://your-domain.example/api/health
```

登录后在管理员的「系统设置」测试 OpenAI 连接，并检查 Word / PDF 上传和客户分享页。

升级前备份数据库和附件。SQLite 备份应在应用停止写入时复制整个数据卷，或使用 SQLite 在线备份接口；不要在写入时仅复制 `.db` 文件。保留卷时重建容器不会丢数据；不要执行 `docker compose down -v`，它会删除数据卷。

Docker 的 SQLite 方案只运行一个应用实例；Vercel 部署使用上面的 PostgreSQL 与 Blob 方案。

## 本地检查

```sh
npm test
node --test deploy/bootstrap-admin.test.mjs
npm run build
```

真正的公网部署还需要服务器连接信息或获授权的云托管账号。源码包准备完成不代表已经上线。
