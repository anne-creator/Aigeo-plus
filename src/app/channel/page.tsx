import Link from "next/link";
import { Empty } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { CHANNELS, sourceLabel } from "@/lib/channels";
import { getClientView, type ClientView } from "@/lib/client-view";
import { prisma } from "@/lib/db";

/**
 * 渠道方首页「我的客户」：只列来源为本渠道的客户，只用客户视图（getClientView）里的数据，
 * 不含任何内部考核信息。管理员可用 ?ch= 预览各渠道看到的页面。
 */
export default async function ChannelHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(["CHANNEL"]);
  const q = await searchParams;
  const isAdmin = session.role === "ADMIN";
  const chParam = Array.isArray(q.ch) ? q.ch[0] : q.ch;
  const channel = isAdmin ? (CHANNELS.find((c) => c.value === chParam)?.value ?? CHANNELS[0].value) : (session.channel ?? null);

  const projects = channel
    ? await prisma.project.findMany({ where: { source: channel }, select: { id: true }, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] })
    : [];
  const views = (await Promise.all(projects.map((p) => getClientView(p.id)))).filter((v): v is ClientView => v !== null);
  const active = views.filter((v) => v.statusLabel === "服务中");
  const avgBase = active.length ? active : views;
  const avgPct = avgBase.length ? Math.round(avgBase.reduce((a, v) => a + v.progressPct, 0) / avgBase.length) : 0;

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs text-muted">
          <span>管理员预览：</span>
          {CHANNELS.map((c) => (
            <Link
              key={c.value}
              href={`/channel?ch=${c.value}` as never}
              className={c.value === channel ? "rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white" : "rounded-md px-2.5 py-1 hover:bg-zinc-100"}
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card px-6 py-6 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Partner</div>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{channel ? sourceLabel(channel) : "渠道合作伙伴"} · 我的客户</h1>
            <p className="mt-1 text-sm text-muted">您推荐给 Aigeo+ 的全部客户，以及每位客户的服务进度与交付物。</p>
          </div>
          <dl className="flex gap-8">
            <Metric label="全部客户" value={String(views.length)} />
            <Metric label="服务中客户" value={String(active.length)} />
            <Metric label="平均进度" value={`${avgPct}%`} />
          </dl>
        </div>
      </section>

      {!channel ? (
        <Empty>您的账号尚未关联渠道，请联系 Aigeo+ 对接人。</Empty>
      ) : views.length === 0 ? (
        <Empty>暂时还没有客户。客户建档后会自动出现在这里。</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {views.map((v) => (
            <ClientCard key={v.projectId} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  服务中: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  已完成: "bg-blue-50 text-blue-700 ring-blue-200",
  已暂停: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  已结束: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

function ClientCard({ v }: { v: ClientView }) {
  const last = v.recent[0]?.date ?? null;
  const pct = Math.max(0, Math.min(100, v.progressPct));
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{v.clientName}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {v.planTierLabel} · {v.startDate} 启动
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[v.statusLabel] ?? STATUS_STYLE["已暂停"]}`}>
          {v.statusLabel}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">{v.dayIndex === 0 ? "尚未开始" : `第 ${v.dayIndex} 天`} / 共 {v.totalDays} 天</span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          已交付 {v.deliveredCount} / {v.totalCount} 项
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted">下一项交付</dt>
          <dd className="mt-0.5">
            {v.next ? (
              <>
                <span className="font-medium">{v.next.title}</span>
                <span className="block text-xs text-muted">{v.next.dueDate <= v.today ? "正在推进" : `计划 ${v.next.dueDate}`}</span>
              </>
            ) : (
              <span className="text-muted">全部交付完成</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">最近交付</dt>
          <dd className="mt-0.5">
            {last ? (
              <>
                <span className="font-medium">{v.recent[0].title}</span>
                <span className="block text-xs text-muted">{last}</span>
              </>
            ) : (
              <span className="text-muted">暂无</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex justify-end">
        <Link
          href={`/channel/${v.projectId}` as never}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          查看详情 <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
