import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-xl border border-border bg-card p-5 shadow-sm", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {right}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-blue-700 border-transparent",
  secondary: "bg-white text-foreground hover:bg-zinc-50 border-border",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  ghost: "bg-transparent text-foreground hover:bg-zinc-100 border-transparent",
};
const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", className, ...rest }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, buttonStyles[variant], className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  className,
  href,
  children,
}: {
  variant?: ButtonVariant;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href as never} className={cx(buttonBase, buttonStyles[variant], className)}>
      {children}
    </Link>
  );
}

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={cx("mb-1 block text-sm font-medium text-foreground", className)} {...rest} />;
}

const fieldBase =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-blue-100";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-28", className)} {...rest} />;
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "zinc";
const toneStyles: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  zinc: "bg-zinc-100 text-zinc-500",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", toneStyles[tone], className)}>
      {children}
    </span>
  );
}

/** 交付节点状态徽章 */
export function StatusBadge({ status }: { status: "OPEN" | "ON_TIME" | "LATE" | "OVERDUE" }) {
  const map: Record<typeof status, { label: string; tone: Tone }> = {
    OPEN: { label: "待提交", tone: "blue" },
    ON_TIME: { label: "按时提交", tone: "green" },
    LATE: { label: "延期提交", tone: "amber" },
    OVERDUE: { label: "已逾期", tone: "red" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** 审核状态徽章 */
export function ReviewBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    NONE: { label: "未提交", tone: "zinc" },
    PENDING: { label: "待审核", tone: "blue" },
    APPROVED: { label: "审核通过", tone: "green" },
    REJECTED: { label: "审核不通过", tone: "red" },
  };
  const m = map[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cx("w-full text-sm", className)} {...rest} />
    </div>
  );
}
export function Th({ className, ...rest }: ComponentProps<"th">) {
  return <th className={cx("bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-muted", className)} {...rest} />;
}
export function Td({ className, ...rest }: ComponentProps<"td">) {
  return <td className={cx("border-t border-border px-3 py-2 align-top", className)} {...rest} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold", tone === "red" && "text-red-600", tone === "green" && "text-emerald-700")}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Alert({ tone = "blue", children }: { tone?: "blue" | "red" | "green" | "amber"; children: ReactNode }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", styles[tone])}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
