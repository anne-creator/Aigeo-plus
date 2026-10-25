"use client";

import { useActionState, useState, useTransition } from "react";
import { prepareFileUpload } from "@/lib/upload-client";
import { Alert, Button, Input, Select } from "@/components/ui";
import { TIMELINE_EXTENSIONS, TIMELINE_FILE_LIMIT, TIMELINE_MAX_ITEMS, type TimelineImportResult } from "@/lib/timeline-import";
import { importTimelineAction, type TimelineFormState } from "./actions";

type Row = { key: number; dueDate: string; title: string; source?: string; warning?: string | null };
let nextKey = 1;
const blank = (dueDate = ""): Row => ({ key: nextKey++, dueDate, title: "" });

export function TimelineRowsEditor({ action, projectId, initial, minDate, mode, replacesPending = false }: {
  action: (prev: TimelineFormState, formData: FormData) => Promise<TimelineFormState>;
  projectId: string;
  initial: Array<{ dueDate: string; title: string }>;
  minDate: string;
  mode: "create" | "revise";
  replacesPending?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [importing, startImport] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<TimelineImportResult | null>(null);
  const [importMode, setImportMode] = useState("append");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => initial.length ? initial.map((r) => ({ key: nextKey++, ...r })) : [blank()]);
  const busy = pending || importing;
  const update = (key: number, patch: Partial<Row>) => { setConfirmed(false); setRows((rs) => rs.map((r) => r.key === key ? { ...r, ...patch } : r)); };
  const remove = (key: number) => { setConfirmed(false); setRows((rs) => rs.length > 1 ? rs.filter((r) => r.key !== key) : [blank()]); };
  const add = () => { setConfirmed(false); setRows((rs) => [...rs, blank(rs.at(-1)?.dueDate ?? "")]); };
  const filled = rows.filter((r) => r.dueDate || r.title.trim());
  const incomplete = filled.filter((r) => !r.dueDate || r.dueDate < minDate || !r.title.trim() || r.title.length > 200).length;

  function importFile(formData: FormData) {
    const file = formData.get("file");
    setImportError(null);
    if (!(file instanceof File) || !file.size) { setImportError("请先选择一个文件"); return; }
    if (file.size > TIMELINE_FILE_LIMIT) { setImportError("文件不能超过 15 MB"); return; }
    formData.set("projectId", projectId);
    startImport(async () => {
      try {
        await prepareFileUpload(formData, "timeline", projectId);
        const response = await importTimelineAction(formData);
        if (response.error || !response.result) { setImportError(response.error || "未能识别文件"); return; }
        const imported = response.result;
        const fresh: Row[] = imported.items.map((i) => ({ key: nextKey++, ...i, dueDate: i.dueDate ?? "" }));
        const base = importMode === "append" ? rows.filter((r) => r.title.trim() || r.dueDate) : [];
        const seen = new Set<string>();
        const next = [...base, ...fresh].filter((r) => {
          const k = r.dueDate + "|" + r.title.toLowerCase().replace(/\s/g, "");
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        if (next.length > TIMELINE_MAX_ITEMS) { setImportError("合并后超过 200 个节点，请减少节点或选择替换后重试"); return; }
        setRows(next); setResult(imported); setConfirmed(false);
      } catch (e) { setImportError((e instanceof Error ? e.message : "识别失败，请重试。") + "当前已填写的节点仍然保留。"); }
    });
  }

  return (
    <div className="space-y-5">
      <form action={importFile} className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
        <h3 className="text-sm font-semibold">1. 上传 timeline 文件</h3>
        <p className="mt-1 text-xs text-muted">支持 Word（.docx）、PDF，也可上传 TXT、Markdown、CSV，最大 15 MB。识别后先核对，不会直接发布给客户。</p>
        <fieldset disabled={busy} className="mt-3 flex flex-wrap items-center gap-3">
          <Input type="file" name="file" accept={TIMELINE_EXTENSIONS} required aria-label="timeline 文件" className="min-w-0 flex-1 bg-white" />
          <Button type="submit" disabled={busy}>{importing ? "正在识别，请稍候…" : "识别文件"}</Button>
          {filled.length > 0 ? <label className="flex w-full items-center gap-2 text-xs text-muted">导入方式
            <Select value={importMode} onChange={(e) => setImportMode(e.target.value)} aria-label="导入方式" className="w-auto bg-white">
              <option value="append">追加到下面的节点</option>
              <option value="replace">替换下面的未完成节点</option>
            </Select>
            {mode === "revise" ? <span>已完成节点始终保留</span> : null}
          </label> : null}
        </fieldset>
        {importError ? <div className="mt-3" role="alert"><Alert tone="red">{importError}</Alert></div> : null}
        {importing ? <p role="status" className="mt-3 text-xs text-accent">正在读取文件和整理日期、事项，复杂文档可能需要一分钟。</p> : null}
      </form>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="sourceFileName" value={result?.fileName ?? ""} />
        <input type="hidden" name="sourceText" value={result?.sourceText ?? ""} />
        <h3 className="text-sm font-semibold">2. 核对节点并确认</h3>
        <p className="text-xs text-muted">日期和事项都可以修改，也可以手动添加或删除。请保留每一波发布的具体名称。</p>
        {result ? <div className="space-y-2" aria-live="polite">
          <Alert tone="blue">已从「{result.fileName}」提取 {result.items.length} 个候选节点，下面共 {filled.length} 个节点，尚未发布。</Alert>
          {result.warnings.map((w, i) => <Alert key={i} tone="amber">{w}</Alert>)}
          {result.sourceText ? <details className="text-xs text-muted"><summary className="cursor-pointer">展开文件原文，对照是否遗漏</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border p-3 font-sans">{result.sourceText}</pre></details> : null}
        </div> : null}
        {state.error ? <div role="alert"><Alert tone="red">{state.error}</Alert></div> : null}
        <fieldset disabled={busy} className="space-y-2">
          {rows.map((r, i) => <div key={r.key} className="rounded-lg border border-border bg-white p-3">
            <div className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-2 sm:grid-cols-[1.5rem_10rem_1fr_2rem]">
              <span className="text-xs text-muted">{i + 1}</span>
              <Input type="date" name="dueDate" value={r.dueDate} min={minDate} required={!!r.title.trim()} onInput={(e) => update(r.key, { dueDate: e.currentTarget.value })} aria-label={"第 " + (i + 1) + " 行日期"} className={!r.dueDate && r.title ? "border-amber-400" : ""} />
              <Input name="title" value={r.title} required={!!r.dueDate} maxLength={200} placeholder="例如：Readiness 发布 / Reddit 第二波" onChange={(e) => update(r.key, { title: e.target.value })} aria-label={"第 " + (i + 1) + " 行事项"} className="col-start-2 sm:col-start-auto" />
              <button type="button" onClick={() => remove(r.key)} className="col-start-3 row-start-1 rounded p-1 text-muted hover:bg-red-50 hover:text-red-700 sm:col-start-auto sm:row-start-auto" aria-label={"删除第 " + (i + 1) + " 行"}>✕</button>
            </div>
            {r.warning ? <p className="mt-2 pl-8 text-xs text-amber-700">需核对：{r.warning}</p> : null}
            {r.source ? <p className="mt-2 break-words pl-8 text-xs text-muted">原文：{r.source}</p> : null}
          </div>)}
          <button type="button" onClick={add} disabled={rows.length >= TIMELINE_MAX_ITEMS} className="text-sm text-accent hover:underline disabled:opacity-50">＋ 手动添加节点</button>
          {mode === "revise" ? <Input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} placeholder="修改原因，例如：根据客户新版 timeline 调整第二波发布" aria-label="修改原因" /> : null}
          {incomplete ? <p className="text-sm text-amber-700" role="status">还有 {incomplete} 个节点需要补全日期或事项。</p> : null}
          <label className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-sm">
            <input type="checkbox" name="confirmed" value="yes" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required className="mt-1" />
            <span>我已对照原文件核对所有节点、日期和批次，确认没有遗漏。{mode === "create" ? "确认后同步到客户时间轴和我的日历。" : "提交后等待管理员审批，通过后同步到客户时间轴和我的日历。"}</span>
          </label>
          <Button type="submit" disabled={busy || !filled.length || incomplete > 0 || !confirmed}>
            {pending ? "提交中…" : mode === "create" ? "确认并同步 " + filled.length + " 个节点" : "确认并提交修改申请"}
          </Button>
          {mode === "revise" ? <p className="text-xs text-muted">{replacesPending ? "本次会替换当前待审批申请。" : "管理员审批前，客户继续看到当前已生效的计划。"}已完成节点保留。</p> : null}
        </fieldset>
      </form>
    </div>
  );
}
