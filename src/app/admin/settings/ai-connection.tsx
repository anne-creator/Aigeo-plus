"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { testOpenAiConnection } from "./actions";

export function AiConnectionTest({ configured }: { configured: boolean }) {
  const [result, action, pending] = useActionState(testOpenAiConnection, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <Button type="submit" variant="secondary" disabled={!configured || pending}>
        {pending ? "正在测试 OpenAI…" : "测试 OpenAI 连接"}
      </Button>
      <p className="text-xs text-muted">测试会产生少量 API 用量；每个不同的已配置模型测试一次。</p>
      {result ? <div role="status"><Alert tone={result.ok ? "green" : "red"}>{result.message}</Alert></div> : null}
    </form>
  );
}
