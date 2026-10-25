// 为使用说明截图：本机 Chrome 无界面模式 + DevTools 协议，2 倍分辨率。
// 用法：在 geo-kpi 目录下 `node scripts/capture-guide-shots.mjs <输出目录>`（需要 npm run dev 已在 3000 端口运行）
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const OUT = path.resolve(process.argv[2] || "guide-shots");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "geo-kpi-dev-secret-change-me-before-production");
async function tokenFor(username) {
  const u = await prisma.user.findUniqueOrThrow({ where: { username } });
  return new SignJWT({ uid: u.id, role: u.role, name: u.name, username: u.username })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(secret);
}

const acme = await prisma.project.findFirstOrThrow({ where: { clientName: { contains: "Acme" } } });
const m2 = await prisma.deliverable.findUniqueOrThrow({ where: { projectId_code_seq: { projectId: acme.id, code: "MONTHLY_REPORT", seq: 2 } } });
const draft = await prisma.taskBatch.findFirstOrThrow({ where: { status: "DRAFT" } });
const gamma = await prisma.project.findFirstOrThrow({ where: { clientName: { contains: "Gamma" } } });
const beta = await prisma.project.findFirstOrThrow({ where: { clientName: { contains: "Beta" } } });
const zhang = await prisma.user.findUniqueOrThrow({ where: { username: "pm.zhang" } });
const weekly3 = await prisma.deliverable.findFirstOrThrow({ where: { projectId: acme.id, code: "WEEKLY_UPDATE", seq: 3 } });
// 受控输入框：用原生 setter 赋值再派发 input 事件，React 才会更新状态
const FILL_ROWS = `(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = [['2026-10-28', '提交第一批 Reddit 内容（3 篇）'], ['2026-11-02', '官网 FAQ 页面上线'], ['2026-11-06', '知识库 v1 发客户确认']];
  const d = document.querySelectorAll('input[name=dueDate]'), t = document.querySelectorAll('input[name=title]');
  rows.forEach((r, i) => { set(d[i], r[0]); set(t[i], r[1]); });
  return true;
})()`;
// 截图用：给 Acme 打开分享链接（db:seed 会清掉）
const shareToken = (await prisma.project.findUniqueOrThrow({ where: { id: acme.id } })).shareToken ?? "guideShot" + acme.id.slice(-12);
await prisma.project.update({ where: { id: acme.id }, data: { shareToken } });

const ONLY = process.argv[3] ? new RegExp(process.argv[3]) : null;
const SHOTS_ALL = [
  { name: "01-login", user: null, url: "/login", w: 1280, h: 720 },
  { name: "02-pm-home", user: "pm.zhang", url: "/pm" },
  { name: "03-new-client", user: "pm.zhang", url: "/pm/projects/new", full: true },
  { name: "04-project-page", user: "pm.zhang", url: `/pm/projects/${acme.id}` },
  { name: "05-timeline-visual", user: "pm.zhang", url: `/pm/projects/${acme.id}`, clipText: "交付时间线" },
  { name: "06-submit", user: "pm.zhang", url: `/pm/projects/${acme.id}/deliverables/${m2.id}` },
  { name: "07-project-timeline-items", user: "pm.zhang", url: `/pm/projects/${acme.id}/timeline` },
  { name: "08-calendar", user: "pm.zhang", url: "/pm", clipSelector: "aside" },
  { name: "09-assign-form", user: "pm.zhang", url: "/pm/tasks" },
  { name: "10-assign-review", user: "pm.zhang", url: `/pm/tasks/${draft.id}` },
  { name: "11-assignee-tasks", user: "intern.zhao", url: "/intern" },
  { name: "12-knowledge", user: "intern.chen", url: "/intern/knowledge", w: 1280, h: 720 },
  { name: "13-admin-home", user: "admin", url: "/admin" },
  { name: "14-admin-settlement", user: "admin", url: `/admin/projects/${acme.id}`, clipSelector: "#q-1" },
  { name: "15-admin-reviews", user: "admin", url: "/admin/reviews" },
  { name: "16-admin-users", user: "admin", url: "/admin/users" },
  { name: "17-admin-settings", user: "admin", url: "/admin/settings" },
  { name: "18-admin-assignees", user: "admin", url: "/admin/interns" },
  { name: "19-week-hours", user: "intern.zhao", url: "/intern", clipSelector: "aside" },
  { name: "20-pm-timeline-revision", user: "pm.li", url: `/pm/projects/${gamma.id}/timeline` },
  { name: "21-admin-timeline-approval", user: "admin", url: "/admin/reviews" },
  { name: "22-share-page", user: null, url: `/share/${shareToken}`, full: true, maxH: 6000 },
  { name: "23-share-mobile", user: null, url: `/share/${shareToken}`, w: 390, h: 844, full: true, maxH: 5000 },
  { name: "24-pm-share-card", user: "pm.zhang", url: `/pm/projects/${acme.id}`, clipText: "分享给客户" },
  { name: "25-partner-login", user: null, url: "/partner", w: 1280, h: 720 },
  { name: "26-channel-home", user: "channel.zhiwai", url: "/channel" },
  { name: "27-channel-detail", user: "channel.zhiwai", url: `/channel/${acme.id}` },
  { name: "28-meeting-new", user: "pm.zhang", url: "/meetings/new", full: true },
  { name: "29-meetings-organizer", user: "pm.zhang", url: "/meetings", full: true },
  { name: "30-meetings-invitee", user: "intern.wang", url: "/meetings" },
  { name: "31-admin-pay", user: "admin", url: "/admin/pay", full: true },
  { name: "32-admin-pay-detail", user: "admin", url: `/admin/pay/${zhang.id}`, clipText: "录入日均有效工作时间" },
  { name: "33-pm-pay", user: "pm.zhang", url: "/pm/pay", full: true },
  { name: "34-pm-ai-review", user: "pm.zhang", url: `/pm/projects/${acme.id}/deliverables/${weekly3.id}`, clipText: "AI 审核" },
  { name: "35-admin-ai-settings", user: "admin", url: "/admin/settings", clipText: "AI 审核与自动扣除" },
  { name: "36-assignee-work", user: "intern.zhao", url: "/intern/work" },
  { name: "37-timeline-entry", user: "pm.zhang", url: `/pm/projects/${beta.id}/timeline`, before: FILL_ROWS, clipText: "录入 timeline" },
  { name: "38-timeline-revise", user: "pm.zhang", url: `/pm/projects/${acme.id}/timeline`, before: "(document.querySelector('main details').open = true, true)", clipSelector: "main details" },
];

const SHOTS = ONLY ? SHOTS_ALL.filter((x) => ONLY.test(x.name)) : SHOTS_ALL;

// ---- Chrome ----
const profile = mkdtempSync(path.join(tmpdir(), "aigeo-shots-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? null;
  } catch {}
}
if (!wsUrl) throw new Error("Chrome 没有启动");
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const waiters = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const once = (method, timeout = 15000) => new Promise((resolve) => {
  waiters.push({ method, resolve }); setTimeout(() => resolve(null), timeout);
});
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

await send("Page.enable");
await send("Network.enable");

for (const s of SHOTS) {
  const w = s.w ?? 1440, h = s.h ?? 900;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: false });
  await send("Network.clearBrowserCookies");
  if (s.user) {
    await send("Network.setCookie", { name: "geo_session", value: await tokenFor(s.user), domain: "localhost", path: "/", httpOnly: true });
  }
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: BASE + s.url });
  await loaded;
  await sleep(1800);
  // 去掉 Next 开发角标
  await evalJs(`document.querySelectorAll('nextjs-portal').forEach(e => e.remove()); true`);
  if (s.before) {
    await evalJs(s.before);
    await sleep(400);
  }

  let clip;
  if (s.clipSelector || s.clipText) {
    const rect = await evalJs(`(() => {
      let el = ${s.clipSelector ? `document.querySelector(${JSON.stringify(s.clipSelector)})` : "null"};
      if (!el && ${JSON.stringify(s.clipText ?? null)}) {
        const t = ${JSON.stringify(s.clipText ?? "")};
        const hit = [...document.querySelectorAll('main h1,main h2,main h3,main div,main span')].find(n => n.childElementCount === 0 && n.textContent.trim() === t);
        el = hit && (hit.closest('section') || hit.parentElement);
      }
      if (!el) return null;
      el.scrollIntoView({block: 'start'});
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
    })()`);
    if (rect) {
      const pad = 12;
      clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + pad * 2, height: rect.height + pad * 2, scale: 1 };
    }
  } else if (s.full) {
    const height = await evalJs(`Math.min(document.documentElement.scrollHeight, ${s.maxH ?? 3200})`);
    clip = { x: 0, y: 0, width: w, height, scale: 1 };
  }
  const shot = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(path.join(OUT, `${s.name}.png`), Buffer.from(shot.data, "base64"));
  console.log("ok", s.name, clip ? `${Math.round(clip.width)}x${Math.round(clip.height)}` : `${w}x${h}`);
}

ws.close();
chrome.kill();
await prisma.$disconnect();
