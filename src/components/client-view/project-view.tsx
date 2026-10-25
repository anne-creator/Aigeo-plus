/**
 * 客户进度视图（分享页、渠道方页面、HTML 导出共用）。
 *
 *   <ClientProjectView view={ClientView} fileHref={(submissionId) => string | null} />
 *   CLIENT_VIEW_CSS：组件用到的全部样式（纯 CSS 字符串），页面和导出的 HTML 都通过 <style> 注入。
 *
 * 纯服务端可渲染：没有 hooks、没有客户端 JS，只用 `cv-` 前缀的类名，
 * 这样网页和 renderToStaticMarkup 导出的单文件 HTML 完全一致。
 * 只展示进度与交付物，不含任何内部考核信息。
 */
import type { ReactNode } from "react";
import type { ClientPhase, ClientStep, ClientStepStatus, ClientView } from "@/lib/client-view";

export { CLIENT_VIEW_CSS } from "./styles";

type FileHref = (submissionId: string) => string | null;

/* ---------------- 日期小工具（纯函数，避免依赖服务端模块） ---------------- */

const DAY = 86_400_000;
const utc = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
const daysBetween = (a: string, b: string) => Math.round((utc(a) - utc(b)) / DAY);
const md = (ymd: string) => ymd.slice(5);
const dotted = (ymd: string) => ymd.replaceAll("-", ".");
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const weekdayOf = (ymd: string) => WEEKDAYS[new Date(utc(ymd)).getUTCDay()];

function bjDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function monthLabel(ym: string): string {
  return `${ym.slice(0, 4)} 年 ${Number(ym.slice(5, 7))} 月`;
}

/* ---------------- 图标 ---------------- */

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v8m0 0l-3.2-3.2M8 10.5l3.2-3.2M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusMark({ status, size = "sm" }: { status: ClientStepStatus; size?: "sm" | "md" }) {
  return (
    <span className={`cv-mark cv-mark-${size} cv-mark-${status.toLowerCase()}`} aria-hidden="true">
      {status === "DONE" ? <CheckIcon size={size === "md" ? 13 : 9} /> : null}
    </span>
  );
}

function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`cv-card${className ? ` ${className}` : ""}`}>
      <div className="cv-sec-head">
        <h2 className="cv-sec-title">{title}</h2>
        {aside ? <div className="cv-sec-aside">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ---------------- 页眉 ---------------- */

function statusTone(label: string): string {
  if (label === "服务中") return "cv-pill-active";
  if (label === "已完成") return "cv-pill-done";
  return "cv-pill-neutral";
}

function Header({ view }: { view: ClientView }) {
  return (
    <header className="cv-header">
      <div className="cv-brandbar">
        <span className="cv-logo">
          Aigeo<span className="cv-logo-plus">+</span>
        </span>
        <span className="cv-eyebrow">GEO 项目进度</span>
      </div>
      <h1 className="cv-title">{view.clientName}</h1>
      <div className="cv-meta">
        <span className={`cv-pill ${statusTone(view.statusLabel)}`}>
          <span className="cv-pill-dot" />
          {view.statusLabel}
        </span>
        <span className="cv-chip">{view.planTierLabel}</span>
        <span className="cv-meta-item">
          服务周期 <b>{dotted(view.startDate)}</b> – <b>{dotted(view.endDate)}</b>
        </span>
        {view.pmName ? <span className="cv-meta-item">项目经理 {view.pmName}</span> : null}
      </div>
    </header>
  );
}

/* ---------------- 概览 ---------------- */

function ProgressRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="cv-ring">
      <svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--cv-track)" strokeWidth="10" />
        {p > 0 ? (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="var(--cv-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}`}
            transform="rotate(-90 64 64)"
          />
        ) : null}
      </svg>
      <div className="cv-ring-label">
        <span className="cv-ring-num">
          {p}
          <span className="cv-ring-pct">%</span>
        </span>
        <span className="cv-ring-sub">整体进度</span>
      </div>
    </div>
  );
}

function Hero({ view }: { view: ClientView }) {
  const notStarted = view.dayIndex === 0;
  const timePct = view.totalDays > 0 ? Math.round((view.dayIndex / view.totalDays) * 100) : 0;
  const remaining = Math.max(0, view.totalDays - view.dayIndex);
  return (
    <section className="cv-card cv-hero">
      <ProgressRing pct={view.progressPct} />
      <div className="cv-hero-body">
        <div className="cv-hero-headline">
          已交付 <b>{view.deliveredCount}</b>
          <span className="cv-hero-of"> / {view.totalCount} 项</span>
        </div>
        <div className="cv-time">
          <div className="cv-time-row">
            <span>{notStarted ? `项目将于 ${dotted(view.startDate)} 启动` : `第 ${view.dayIndex} 天 / 共 ${view.totalDays} 天`}</span>
            <span className="cv-muted">{notStarted ? `共 ${view.totalDays} 天` : remaining > 0 ? `剩余 ${remaining} 天` : "服务周期已满"}</span>
          </div>
          <div className="cv-bar">
            <div className="cv-bar-fill" style={{ width: `${timePct}%` }} />
          </div>
        </div>
        <div className="cv-next">
          <span className="cv-next-label">下一项</span>
          {view.next ? (
            <span className="cv-next-text">
              {/* 计划日已过的（进行中）不再显示日期 */}
              <span className="cv-next-date">{view.next.dueDate >= view.today ? md(view.next.dueDate) : "进行中"}</span>
              {view.next.title}
            </span>
          ) : (
            <span className="cv-next-text">全部交付物已完成</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 里程碑时间轴 ---------------- */

function phaseStatus(ph: ClientPhase): ClientStepStatus {
  if (ph.steps.length > 0 && ph.steps.every((s) => s.status === "DONE")) return "DONE";
  if (ph.steps.some((s) => s.status !== "PLANNED")) return "IN_PROGRESS";
  return "PLANNED";
}

function phaseRange(ph: ClientPhase): { from: string; to: string } {
  const dates = ph.steps.map((s) => s.dueDate).sort();
  return { from: dates[0] ?? "", to: dates[dates.length - 1] ?? "" };
}

/** 今天在横向轨道上的位置（单位：列；第 i 列的圆点在 i + 0.5） */
function todayPosition(view: ClientView, ends: string[]): number {
  const n = ends.length;
  const t = view.today;
  const frac = (a: string, b: string) => {
    const span = daysBetween(b, a);
    return span <= 0 ? 1 : Math.max(0, Math.min(1, daysBetween(t, a) / span));
  };
  if (t <= ends[0]) return 0.5 * frac(view.startDate, ends[0]);
  for (let k = 0; k < n - 1; k++) {
    if (t > ends[k] && t <= ends[k + 1]) return k + 0.5 + frac(ends[k], ends[k + 1]);
  }
  return n - 0.5 + 0.5 * frac(ends[n - 1], view.endDate);
}

const STATUS_TEXT: Record<ClientStepStatus, string> = { DONE: "已完成", IN_PROGRESS: "进行中", PLANNED: "计划中" };

function Milestones({ view }: { view: ClientView }) {
  const phases = view.phases.filter((p) => p.steps.length > 0);
  if (phases.length === 0) return <p className="cv-empty">里程碑将在项目启动后生成。</p>;
  const n = phases.length;
  const ranges = phases.map(phaseRange);
  const ends = ranges.map((r) => r.to);
  const showToday = view.today >= view.startDate && view.today <= view.endDate;
  const pos = showToday ? todayPosition(view, ends) : 0;
  const col = 100 / n;
  const fillWidth = Math.max(0, pos - 0.5) * col;
  // 窄屏/打印时改为竖排，“今天”插在第一个尚未结束的阶段之前
  const todayBefore = showToday ? ends.findIndex((e) => e >= view.today) : -1;

  const todayRow = (
    <div className="cv-today-row" key="today-row">
      <span className="cv-today-row-dot" />
      <span className="cv-today-tag">今天 · {md(view.today)}</span>
    </div>
  );

  return (
    <div className="cv-track-scroll">
      <div className="cv-track" style={{ minWidth: `${n * 168}px` }}>
        <div className="cv-track-line" style={{ left: `${col / 2}%`, right: `${col / 2}%` }} />
        {fillWidth > 0 ? <div className="cv-track-fill" style={{ left: `${col / 2}%`, width: `${fillWidth}%` }} /> : null}
        {showToday ? (
          <div className="cv-today" style={{ left: `${pos * col}%` }}>
            <span className="cv-today-tag">今天 · {md(view.today)}</span>
            <span className="cv-today-stem" />
          </div>
        ) : null}
        {phases.map((ph, i) => {
          const st = phaseStatus(ph);
          const r = ranges[i];
          const doneCount = ph.steps.filter((s) => s.status === "DONE").length;
          const isPlan = ph.steps.length === 1 && ph.steps[0].key.startsWith("plan-");
          return [
            i === todayBefore ? todayRow : null,
            <div key={ph.label + "-" + i} className={`cv-ms cv-ms-${st.toLowerCase()}`}>
              <div className="cv-ms-dot">{st === "DONE" ? <CheckIcon size={13} /> : st === "IN_PROGRESS" ? <span className="cv-ms-core" /> : null}</div>
              <div className="cv-ms-body">
                <div className="cv-ms-label">{isPlan ? ph.steps[0].title : ph.label}</div>
                <div className="cv-ms-date">{r.from === r.to ? md(r.from) : `${md(r.from)} – ${md(r.to)}`}</div>
                <div className={`cv-ms-tag cv-ms-tag-${st.toLowerCase()}`}>
                  {STATUS_TEXT[st]}
                  {st === "IN_PROGRESS" ? ` · ${doneCount}/${ph.steps.length}` : null}
                </div>
                {!isPlan ? <ul className="cv-ms-steps">
                  {ph.steps.map((s) => (
                    <li key={s.key} className={`cv-ms-step cv-ms-step-${s.status.toLowerCase()}`}>
                      <StatusMark status={s.status} />
                      <span>{s.title}</span>
                    </li>
                  ))}
                </ul> : null}
              </div>
            </div>,
          ];
        })}
        {showToday && todayBefore === -1 ? todayRow : null}
      </div>
    </div>
  );
}

/* ---------------- 交付物 ---------------- */

const UPCOMING_VISIBLE = 5;

function DeliveredRow({ s, fileHref }: { s: ClientStep; fileHref: FileHref }) {
  const href = s.file ? fileHref(s.file.submissionId) : null;
  return (
    <li className="cv-row">
      <StatusMark status="DONE" size="md" />
      <div className="cv-row-main">
        <div className="cv-row-title">{s.title}</div>
        <div className="cv-row-sub">
          交付于 {s.deliveredDate ? dotted(s.deliveredDate) : dotted(s.dueDate)}
          {href && s.file ? <span className="cv-row-file"> · {s.file.fileName}</span> : null}
        </div>
      </div>
      {href ? (
        <a className="cv-btn" href={href} rel="noopener" download>
          <DownloadIcon />
          下载
        </a>
      ) : null}
    </li>
  );
}

function UpcomingRow({ s }: { s: ClientStep }) {
  return (
    <li className="cv-row">
      <StatusMark status={s.status} size="md" />
      <div className="cv-row-main">
        <div className="cv-row-title">{s.title}</div>
        <div className="cv-row-sub">{s.status === "IN_PROGRESS" ? "正在推进" : `计划 ${dotted(s.dueDate)}`}</div>
      </div>
      {s.status === "IN_PROGRESS" ? <span className="cv-tag cv-tag-blue">进行中</span> : <span className="cv-tag">计划中</span>}
    </li>
  );
}

function Deliverables({ view, fileHref }: { view: ClientView; fileHref: FileHref }) {
  const all = view.phases.flatMap((p) => p.steps);
  const delivered = all.filter((s) => s.status === "DONE").sort((a, b) => ((a.deliveredDate ?? a.dueDate) < (b.deliveredDate ?? b.dueDate) ? 1 : -1));
  const upcoming = all.filter((s) => s.status !== "DONE").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const shown = upcoming.slice(0, UPCOMING_VISIBLE);
  const rest = upcoming.slice(UPCOMING_VISIBLE);
  return (
    <Section title="交付物" aside={`已交付 ${delivered.length} 项 · 待交付 ${upcoming.length} 项`}>
      <div className="cv-cols">
        <div>
          <h3 className="cv-sub-title">已交付</h3>
          {delivered.length === 0 ? (
            <p className="cv-empty">首批交付物准备中。</p>
          ) : (
            <ul className="cv-list">
              {delivered.map((s) => (
                <DeliveredRow key={s.key} s={s} fileHref={fileHref} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="cv-sub-title">即将交付</h3>
          {upcoming.length === 0 ? (
            <p className="cv-empty">全部交付物已完成。</p>
          ) : (
            <>
              <ul className="cv-list">
                {shown.map((s) => (
                  <UpcomingRow key={s.key} s={s} />
                ))}
              </ul>
              {rest.length > 0 ? (
                <details className="cv-more">
                  <summary>查看其余 {rest.length} 项</summary>
                  <ul className="cv-list">
                    {rest.map((s) => (
                      <UpcomingRow key={s.key} s={s} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ---------------- 每周进展 ---------------- */

const WEEKLY_VISIBLE = 4;

function Weekly({ view }: { view: ClientView }) {
  const past = view.weekly.filter((w) => w.dueDate <= view.today).sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
  // 已同步的周全部展示；尚未同步的只保留最近一周（显示“整理中”）
  const items = past.filter((w, i) => w.status === "DONE" || i === 0);
  if (items.length === 0) return null;
  const weekNo = (d: string) => Math.max(1, Math.floor(daysBetween(d, view.startDate) / 7) + 1);
  const row = (w: (typeof items)[number]) => (
    <li key={w.dueDate} className="cv-week">
      <div className="cv-week-head">
        <span className="cv-week-no">第 {weekNo(w.dueDate)} 周</span>
        <span className="cv-week-date">
          {dotted(w.dueDate)} {weekdayOf(w.dueDate)}
        </span>
      </div>
      {w.status === "DONE" ? (
        w.text ? (
          <p className="cv-week-text">{w.text}</p>
        ) : (
          <p className="cv-week-text cv-muted">本周进展已同步。</p>
        )
      ) : (
        <p className="cv-week-text cv-muted">本周进展整理中，稍后更新。</p>
      )}
    </li>
  );
  const shown = items.slice(0, WEEKLY_VISIBLE);
  const rest = items.slice(WEEKLY_VISIBLE);
  return (
    <Section title="每周进展" aside="最新在前">
      <ul className="cv-weeks">{shown.map(row)}</ul>
      {rest.length > 0 ? (
        <details className="cv-more">
          <summary>查看更早的 {rest.length} 周</summary>
          <ul className="cv-weeks">{rest.map(row)}</ul>
        </details>
      ) : null}
    </Section>
  );
}

/* ---------------- 项目计划 ---------------- */

function Plan({ view }: { view: ClientView }) {
  if (view.timeline.length === 0) {
    return (
      <Section title="项目计划">
        <p className="cv-empty">详细计划将在基线报告确认后发布。</p>
      </Section>
    );
  }
  const groups = new Map<string, ClientView["timeline"]>();
  for (const t of view.timeline) {
    const ym = t.dueDate.slice(0, 7);
    const g = groups.get(ym);
    if (g) g.push(t);
    else groups.set(ym, [t]);
  }
  const done = view.timeline.filter((t) => t.done).length;
  return (
    <Section title="项目计划" aside={`已完成 ${done} / ${view.timeline.length}`}>
      <div className="cv-months">
        {[...groups.entries()].map(([ym, items]) => (
          <div key={ym} className="cv-month">
            <div className="cv-month-head">
              <span className="cv-month-name">{monthLabel(ym)}</span>
              <span className="cv-muted">
                {items.filter((t) => t.done).length} / {items.length}
              </span>
            </div>
            <ul className="cv-plan">
              {items.map((t, i) => (
                <li key={`${t.dueDate}-${i}`} className={`cv-plan-item${t.done ? " cv-plan-done" : ""}`}>
                  <StatusMark status={t.done ? "DONE" : "PLANNED"} />
                  <span className="cv-plan-date">{md(t.dueDate)}</span>
                  <span className="cv-plan-title">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- 本季度目标 ---------------- */

function Goals({ view }: { view: ClientView }) {
  if (view.kpis.length === 0) return null;
  return (
    <Section title="本季度目标">
      <div className="cv-kpis">
        {view.kpis.map((k, i) => (
          <div key={`${k.name}-${i}`} className="cv-kpi">
            <div className="cv-kpi-name">{k.name}</div>
            <div className="cv-kpi-value">
              {k.target}
              {k.unit ? <span className="cv-kpi-unit">{k.unit}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- 整页 ---------------- */

export function ClientProjectView({ view, fileHref }: { view: ClientView; fileHref: FileHref }) {
  return (
    <div className="cv-root">
      <div className="cv-page">
        <Header view={view} />
        <Hero view={view} />
        <Section title="项目里程碑" aside={<Legend />}>
          <Milestones view={view} />
        </Section>
        <Deliverables view={view} fileHref={fileHref} />
        <Weekly view={view} />
        <Plan view={view} />
        <Goals view={view} />
        <footer className="cv-footer">
          <div>更新于 {bjDateTime(view.updatedAt)}（北京时间）· Aigeo+</div>
          <div className="cv-footer-brand">由 Aigeo+ 提供</div>
        </footer>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <span className="cv-legend">
      <span className="cv-legend-item">
        <StatusMark status="DONE" />
        已完成
      </span>
      <span className="cv-legend-item">
        <StatusMark status="IN_PROGRESS" />
        进行中
      </span>
      <span className="cv-legend-item">
        <StatusMark status="PLANNED" />
        计划中
      </span>
    </span>
  );
}
