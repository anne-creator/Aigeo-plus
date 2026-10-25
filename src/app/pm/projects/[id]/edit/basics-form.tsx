"use client";

import { useActionState } from "react";
import { Alert, Button, Card, CardTitle, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { CLIENT_SOURCES } from "@/lib/channels";
import { updateProjectBasicsAction, type ProjectFormState } from "../../actions";

/** 编辑基本信息：填错时只提示，已填写的内容原样保留 */
export function BasicsForm({
  projectId,
  cancelHref,
  initial,
}: {
  projectId: string;
  cancelHref: string;
  initial: { clientName: string; websiteUrl: string; source: string; notes: string };
}) {
  const [state, action, pending] = useActionState(updateProjectBasicsAction, { error: null, values: {}, seq: 0 } as ProjectFormState);
  const v = (k: keyof typeof initial) => state.values[k] ?? initial[k];

  return (
    <form key={state.seq} action={action} className="space-y-6">
      {state.error ? (
        <div role="alert">
          <Alert tone="red">{state.error}（已填写的内容都保留着，改好后再保存即可）</Alert>
        </div>
      ) : null}
      <input type="hidden" name="id" value={projectId} />
      <Card>
        <CardTitle>可修改项</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="客户名称 *">
            <Input name="clientName" required maxLength={100} defaultValue={v("clientName")} />
          </Field>
          <Field label="客户官网" hint="选填，例如 acme.com">
            <Input name="websiteUrl" maxLength={300} placeholder="acme.com" defaultValue={v("websiteUrl")} />
          </Field>
          <Field label="客户来源 *" hint="选择渠道方后，该渠道方可在其专属页面查看此客户的进度与交付物">
            <Select name="source" required defaultValue={v("source")}>
              {CLIENT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="备注">
            <Textarea name="notes" maxLength={2000} defaultValue={v("notes")} />
          </Field>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "正在保存…" : "保存"}
        </Button>
        <LinkButton href={cancelHref} variant="ghost">
          取消
        </LinkButton>
      </div>
    </form>
  );
}
