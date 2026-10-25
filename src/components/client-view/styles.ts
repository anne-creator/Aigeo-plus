/**
 * 客户进度视图的全部样式。纯 CSS 字符串、类名统一 `cv-` 前缀，
 * 不依赖 Tailwind：网页 <style> 注入与导出的单文件 HTML 共用同一份。
 * 不使用红色；状态色：已完成绿、进行中深蓝、计划中灰。
 */
export const CLIENT_VIEW_CSS = String.raw`
.cv-root {
  --cv-ink: #0f172a;
  --cv-text: #334155;
  --cv-muted: #64748b;
  --cv-faint: #94a3b8;
  --cv-line: #e6e9f0;
  --cv-track: #e8ecf4;
  --cv-bg: #f5f7fb;
  --cv-card: #ffffff;
  --cv-accent: #1e40af;
  --cv-accent-strong: #1e3a8a;
  --cv-accent-soft: #eef3ff;
  --cv-done: #16a34a;
  --cv-done-soft: #ecfdf3;
  --cv-planned: #cbd5e1;
  --cv-radius: 16px;
  color-scheme: light;
  flex: 1 0 auto;
  width: 100%;
  min-height: 100vh;
  background: var(--cv-bg);
  color: var(--cv-text);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
/* 重置用 :where() 降为零优先级，组件类名总能覆盖 */
:where(.cv-root) *, :where(.cv-root) *::before, :where(.cv-root) *::after { box-sizing: border-box; }
:where(.cv-root) :where(h1, h2, h3, p, ul, li) { margin: 0; padding: 0; }
:where(.cv-root) ul { list-style: none; }
:where(.cv-root) b { font-weight: 600; color: var(--cv-ink); }
:where(.cv-root) a { color: inherit; text-decoration: none; }
:where(.cv-root) svg { display: block; }

.cv-page { max-width: 1000px; margin: 0 auto; padding: 48px 24px 56px; }
.cv-muted { color: var(--cv-muted); }
.cv-empty { color: var(--cv-muted); font-size: 13px; padding: 4px 0; }

/* ---------- 页眉 ---------- */
.cv-header { padding: 0 4px 28px; }
.cv-brandbar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.cv-logo { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; color: var(--cv-ink); }
.cv-logo-plus { color: var(--cv-accent); }
.cv-eyebrow {
  font-size: 12px; font-weight: 600; letter-spacing: 0.12em; color: var(--cv-accent);
  padding-left: 12px; border-left: 1px solid var(--cv-line);
}
.cv-title { font-size: 32px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; color: var(--cv-ink); }
.cv-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 14px; font-size: 13px; color: var(--cv-muted); }
.cv-meta-item b { font-variant-numeric: tabular-nums; }
.cv-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.cv-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.cv-pill-active { background: var(--cv-accent-soft); color: var(--cv-accent); }
.cv-pill-done { background: var(--cv-done-soft); color: var(--cv-done); }
.cv-pill-neutral { background: #f1f5f9; color: var(--cv-muted); }
.cv-chip { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--cv-line); background: var(--cv-card); color: var(--cv-text); font-size: 12px; font-weight: 500; }

/* ---------- 卡片 ---------- */
.cv-card {
  background: var(--cv-card); border: 1px solid var(--cv-line); border-radius: var(--cv-radius);
  padding: 28px; margin-bottom: 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 24px -12px rgba(15, 23, 42, 0.08);
}
.cv-sec-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; margin-bottom: 20px; }
.cv-sec-title { font-size: 17px; font-weight: 600; color: var(--cv-ink); letter-spacing: -0.01em; }
.cv-sec-aside { font-size: 12px; color: var(--cv-muted); }
.cv-sub-title { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--cv-faint); margin-bottom: 6px; }

/* ---------- 状态小圆点 ---------- */
.cv-mark { flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; }
.cv-mark-sm { width: 14px; height: 14px; }
.cv-mark-md { width: 22px; height: 22px; }
.cv-mark-done { background: var(--cv-done); color: #fff; }
.cv-mark-in_progress { background: var(--cv-accent); box-shadow: inset 0 0 0 3px var(--cv-accent), inset 0 0 0 5px #fff; }
.cv-mark-sm.cv-mark-in_progress { box-shadow: inset 0 0 0 2px var(--cv-accent), inset 0 0 0 4px #fff; }
.cv-mark-planned { background: #fff; border: 2px solid var(--cv-planned); }

/* ---------- 概览 ---------- */
.cv-hero { display: flex; align-items: center; gap: 36px; padding: 32px; }
.cv-ring { position: relative; width: 148px; height: 148px; flex: none; }
.cv-ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cv-ring-num { font-size: 36px; font-weight: 700; line-height: 1; color: var(--cv-ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.cv-ring-pct { font-size: 16px; font-weight: 600; margin-left: 1px; color: var(--cv-muted); }
.cv-ring-sub { margin-top: 6px; font-size: 12px; color: var(--cv-muted); }
.cv-hero-body { flex: 1; min-width: 0; }
.cv-hero-headline { font-size: 22px; color: var(--cv-ink); letter-spacing: -0.01em; }
.cv-hero-headline b { font-size: 30px; font-weight: 700; color: var(--cv-accent); font-variant-numeric: tabular-nums; }
.cv-hero-of { color: var(--cv-muted); font-size: 18px; }
.cv-time { margin-top: 18px; }
.cv-time-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--cv-text); margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.cv-bar { height: 8px; border-radius: 999px; background: var(--cv-track); overflow: hidden; }
.cv-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #3b5bdb, var(--cv-accent)); }
.cv-next { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding: 12px 14px; border-radius: 12px; background: var(--cv-accent-soft); }
.cv-next-label { flex: none; font-size: 12px; font-weight: 600; color: var(--cv-accent); padding-right: 12px; border-right: 1px solid rgba(30, 64, 175, 0.18); }
.cv-next-text { font-size: 14px; font-weight: 500; color: var(--cv-ink); min-width: 0; }
.cv-next-date { font-variant-numeric: tabular-nums; color: var(--cv-accent); font-weight: 600; margin-right: 8px; }

/* ---------- 图例 ---------- */
.cv-legend { display: inline-flex; flex-wrap: wrap; gap: 14px; }
.cv-legend-item { display: inline-flex; align-items: center; gap: 6px; }

/* ---------- 里程碑时间轴（横向） ---------- */
.cv-track-scroll { overflow-x: auto; margin: 0 -28px; padding: 0 28px 4px; -webkit-overflow-scrolling: touch; }
.cv-track { position: relative; display: flex; padding-top: 38px; }
.cv-track-line, .cv-track-fill { position: absolute; top: 49px; height: 2px; border-radius: 2px; }
.cv-track-line { background: var(--cv-track); }
.cv-track-fill { background: linear-gradient(90deg, var(--cv-done), var(--cv-accent)); }
.cv-today { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 2; pointer-events: none; }
.cv-today-tag { display: inline-block; white-space: nowrap; font-size: 11px; font-weight: 600; line-height: 20px; padding: 0 8px; border-radius: 999px; background: var(--cv-accent); color: #fff; font-variant-numeric: tabular-nums; }
.cv-today-stem { width: 2px; height: 22px; background: var(--cv-accent); border-radius: 2px; }
.cv-today-row { display: none; }

.cv-ms { position: relative; flex: 1 1 0; min-width: 0; padding: 0 10px; text-align: center; }
.cv-ms-dot {
  position: relative; z-index: 1; width: 24px; height: 24px; margin: 0 auto; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.cv-ms-done .cv-ms-dot { background: var(--cv-done); color: #fff; box-shadow: 0 0 0 4px var(--cv-card); }
.cv-ms-in_progress .cv-ms-dot { background: var(--cv-accent); box-shadow: 0 0 0 4px var(--cv-card), 0 0 0 7px rgba(30, 64, 175, 0.16); }
.cv-ms-core { width: 8px; height: 8px; border-radius: 50%; background: #fff; }
.cv-ms-planned .cv-ms-dot { background: #fff; border: 2px solid var(--cv-planned); box-shadow: 0 0 0 4px var(--cv-card); }
.cv-ms-body { margin-top: 14px; }
.cv-ms-label { font-size: 14px; font-weight: 600; color: var(--cv-ink); line-height: 1.4; }
.cv-ms-planned .cv-ms-label { color: var(--cv-text); }
.cv-ms-date { font-size: 12px; color: var(--cv-muted); font-variant-numeric: tabular-nums; margin-top: 2px; }
.cv-ms-tag { display: inline-block; margin-top: 8px; font-size: 11px; font-weight: 600; line-height: 20px; padding: 0 8px; border-radius: 999px; }
.cv-ms-tag-done { background: var(--cv-done-soft); color: var(--cv-done); }
.cv-ms-tag-in_progress { background: var(--cv-accent-soft); color: var(--cv-accent); }
.cv-ms-tag-planned { background: #f1f5f9; color: var(--cv-muted); }
.cv-ms-steps { margin: 14px auto 0; max-width: 180px; text-align: left; border-top: 1px dashed var(--cv-line); padding-top: 10px; }
.cv-ms-step { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.45; color: var(--cv-text); padding: 3px 0; }
.cv-ms-step .cv-mark { margin-top: 2px; }
.cv-ms-step-planned { color: var(--cv-muted); }

/* ---------- 交付物 ---------- */
.cv-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 40px; }
.cv-list { display: block; }
.cv-row { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--cv-line); }
.cv-list .cv-row:last-child { border-bottom: 0; }
.cv-row-main { flex: 1; min-width: 0; }
.cv-row-title { font-size: 14px; font-weight: 500; color: var(--cv-ink); }
.cv-row-sub { font-size: 12px; color: var(--cv-muted); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-btn {
  flex: none; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: 8px; border: 1px solid rgba(30, 64, 175, 0.22); background: var(--cv-card);
  color: var(--cv-accent); font-size: 13px; font-weight: 600; white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.cv-btn:hover { background: var(--cv-accent-soft); border-color: rgba(30, 64, 175, 0.4); }
.cv-tag { flex: none; font-size: 11px; font-weight: 600; line-height: 22px; padding: 0 9px; border-radius: 999px; background: #f1f5f9; color: var(--cv-muted); white-space: nowrap; }
.cv-tag-blue { background: var(--cv-accent-soft); color: var(--cv-accent); }
.cv-more { margin-top: 6px; }
.cv-more summary { cursor: pointer; font-size: 13px; font-weight: 500; color: var(--cv-accent); padding: 8px 0; list-style: none; }
.cv-more summary::-webkit-details-marker { display: none; }
.cv-more summary::after { content: " ↓"; }
.cv-more[open] summary::after { content: " ↑"; }

/* ---------- 每周进展 ---------- */
.cv-weeks { display: block; }
.cv-week { position: relative; padding: 0 0 18px 22px; border-left: 2px solid var(--cv-track); margin-left: 5px; }
.cv-weeks .cv-week:last-child { padding-bottom: 2px; }
.cv-week::before { content: ""; position: absolute; left: -7px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid var(--cv-accent); }
.cv-week-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.cv-week-no { font-size: 14px; font-weight: 600; color: var(--cv-ink); }
.cv-week-date { font-size: 12px; color: var(--cv-muted); font-variant-numeric: tabular-nums; }
.cv-week-text { margin-top: 6px; font-size: 13.5px; line-height: 1.75; color: var(--cv-text); white-space: pre-wrap; word-break: break-word; }
.cv-week-text.cv-muted { color: var(--cv-muted); }

/* ---------- 项目计划 ---------- */
.cv-months { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.cv-month { border: 1px solid var(--cv-line); border-radius: 12px; padding: 16px 18px; background: #fbfcfe; }
.cv-month-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 12px; }
.cv-month-name { font-size: 14px; font-weight: 600; color: var(--cv-ink); }
.cv-plan-item { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; font-size: 13px; line-height: 1.5; }
.cv-plan-item .cv-mark { margin-top: 3px; }
.cv-plan-date { flex: none; width: 40px; color: var(--cv-muted); font-variant-numeric: tabular-nums; }
.cv-plan-title { flex: 1; min-width: 0; color: var(--cv-ink); }
.cv-plan-done .cv-plan-title { color: var(--cv-muted); }

/* ---------- 本季度目标 ---------- */
.cv-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.cv-kpi { border-radius: 12px; padding: 16px 18px; background: linear-gradient(180deg, var(--cv-accent-soft), #f7f9ff); border: 1px solid rgba(30, 64, 175, 0.08); }
.cv-kpi-name { font-size: 12px; color: var(--cv-muted); line-height: 1.5; }
.cv-kpi-value { margin-top: 6px; font-size: 26px; font-weight: 700; line-height: 1.2; color: var(--cv-accent-strong); letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.cv-kpi-unit { font-size: 13px; font-weight: 500; color: var(--cv-muted); margin-left: 4px; }

/* ---------- 页脚 ---------- */
.cv-footer { margin-top: 32px; padding: 0 4px; text-align: center; font-size: 12px; color: var(--cv-faint); font-variant-numeric: tabular-nums; }
.cv-footer-brand { margin-top: 4px; letter-spacing: 0.06em; }

/* ---------- 窄屏与打印：单列、时间轴竖排 ---------- */
@media (max-width: 720px), print {
  .cv-track-scroll { overflow: visible; margin: 0; padding: 0; }
  .cv-track { flex-direction: column; min-width: 0 !important; padding-top: 0; }
  .cv-track-line, .cv-track-fill, .cv-today { display: none; }
  .cv-ms { display: flex; align-items: flex-start; gap: 16px; padding: 0 0 22px; text-align: left; }
  .cv-ms::before { content: ""; position: absolute; left: 11px; top: 24px; bottom: 0; width: 2px; background: var(--cv-track); }
  .cv-ms-done::before { background: var(--cv-done); opacity: 0.35; }
  .cv-track .cv-ms:last-child { padding-bottom: 0; }
  .cv-track .cv-ms:last-child::before { display: none; }
  .cv-ms-dot { flex: none; margin: 0; }
  .cv-ms-body { flex: 1; min-width: 0; margin-top: 1px; }
  .cv-ms-label, .cv-ms-date { display: inline; }
  .cv-ms-date { margin-left: 8px; }
  .cv-ms-tag { display: table; margin-top: 6px; }
  .cv-ms-steps { margin: 8px 0 0; max-width: none; border-top: 0; padding-top: 0; }
  .cv-today-row { position: relative; display: flex; align-items: center; gap: 16px; padding: 0 0 22px; }
  .cv-today-row::before { content: ""; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: var(--cv-track); }
  .cv-today-row-dot { position: relative; z-index: 1; flex: none; width: 24px; height: 2px; background: var(--cv-accent); border-radius: 2px; }
  .cv-track .cv-today-row:last-child { padding-bottom: 0; }
  .cv-track .cv-today-row:last-child::before { bottom: 50%; }
}
@media (max-width: 720px) {
  .cv-page { padding: 28px 16px 40px; }
  .cv-title { font-size: 26px; }
  .cv-card { padding: 20px; border-radius: 14px; margin-bottom: 14px; }
  .cv-hero { flex-direction: column; align-items: stretch; gap: 20px; padding: 24px 20px; }
  .cv-ring { margin: 0 auto; width: 136px; height: 136px; }
  .cv-hero-headline { text-align: center; }
  .cv-cols { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .cv-months { grid-template-columns: 1fr; }
  .cv-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cv-sec-head { margin-bottom: 14px; }
}
@media print {
  @page { margin: 14mm; }
  .cv-root { background: #fff; min-height: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cv-page { max-width: none; padding: 0; }
  .cv-card { box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
  .cv-btn { display: none; }
  .cv-more summary { display: none; }
  .cv-ms, .cv-week, .cv-month, .cv-row { break-inside: avoid; }
}
`;
