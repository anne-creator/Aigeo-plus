"use client";

import { useRef, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

const PLACEHOLDER = "1. 剪辑 3 条产品短视频，DDL 10/25\n2. 润色 Reddit 帖子 5 篇（截止 10.28）";

/** 任务内容：文字或文档二选一（选了文档后文字可不填） */
export function SourceInputs({ accept }: { accept: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  return (
    <div className="space-y-2">
      <textarea
        name="text"
        required={!fileName}
        maxLength={60000}
        placeholder={PLACEHOLDER}
        className="min-h-40 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-accent focus:ring-2 focus:ring-blue-100"
        aria-label="任务内容"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">或</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 hover:border-accent hover:text-accent">
          <span aria-hidden>📎</span>
          {fileName ? <span className="max-w-56 truncate">{fileName}</span> : "上传文档"}
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? "")}
          />
        </label>
        {fileName ? (
          <button
            type="button"
            className="text-xs text-muted hover:underline"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              setFileName("");
            }}
          >
            移除
          </button>
        ) : (
          <span className="text-xs text-muted">{accept.split(",").join(" ")}</span>
        )}
      </div>
    </div>
  );
}

/** 提交按钮：提交中显示进度文字 */
export function SubmitButton({ pendingText, children, ...rest }: ComponentProps<typeof Button> & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending ? pendingText : children}
    </Button>
  );
}
