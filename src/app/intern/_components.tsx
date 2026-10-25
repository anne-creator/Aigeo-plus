"use client";

import { useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** 提交按钮：上传期间显示“提交中…”并禁用，避免重复点击 */
export function SubmitButton({
  children,
  pendingText = "提交中…",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}

/**
 * 日历里的链接是 /intern#task-<id>：目标任务如果在折叠的“已完成”里，先展开再滚动过去。
 */
export function HashOpener() {
  useEffect(() => {
    function reveal() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("task-")) return;
      const el = document.getElementById(id);
      if (!el) return;
      let p: HTMLElement | null = el.parentElement;
      while (p) {
        if (p instanceof HTMLDetailsElement) p.open = true;
        p = p.parentElement;
      }
      el.scrollIntoView({ block: "start" });
    }
    // 同页点击日历链接时 Next 用 pushState 改 hash，不会触发 hashchange，所以也监听点击
    function onClick(e: MouseEvent) {
      const a = e.target instanceof Element ? e.target.closest("a[href*='#task-']") : null;
      if (a) window.setTimeout(reveal, 50);
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    window.addEventListener("popstate", reveal);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("popstate", reveal);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
