#!/usr/bin/env python3
"""Stream a Nemotron response and report generation speed."""

import argparse
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request
from local_model_http import open_local_model


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", nargs="?", default="What is 2+2? Answer in one word.")
    parser.add_argument("--url", default="http://100.89.121.112:8000/v1/chat/completions")
    parser.add_argument("--max-tokens", type=int, default=1024)
    args = parser.parse_args()

    body = {
        "model": "coo-llm",
        "messages": [{"role": "user", "content": args.prompt}],
        "max_tokens": args.max_tokens,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": False},
        "stream_options": {"include_usage": True},
    }
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream", "User-Agent": "curl/8.5.0"}
    request = Request(
        args.url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
    )

    started = time.perf_counter()
    first_token = last_token = None
    usage = None
    finish_reason = None
    current_section = None
    chunks = 0

    try:
        with open_local_model(request, service="llm", timeout=180) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                event = json.loads(data)
                usage = event.get("usage") or usage
                for choice in event.get("choices", []):
                    finish_reason = choice.get("finish_reason") or finish_reason
                    delta = choice.get("delta", {})
                    for key, label in (("reasoning", "Thinking"), ("content", "Answer")):
                        value = delta.get(key)
                        if not value:
                            continue
                        now = time.perf_counter()
                        first_token = first_token or now
                        last_token = now
                        chunks += 1
                        if current_section != key:
                            print(f"\n{label}: ", end="", flush=True)
                            current_section = key
                        print(value, end="", flush=True)
    except HTTPError as exc:
        print(f"\nHTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"\nConnection failed: {exc.reason}", file=sys.stderr)
        return 1

    print()
    if first_token is None:
        print("No output tokens received.", file=sys.stderr)
        return 1

    tokens = usage.get("completion_tokens") if usage else None
    ttft = first_token - started
    if tokens is not None:
        generation_time = max(last_token - first_token, 1e-9)
        speed = (tokens - 1) / generation_time if tokens > 1 else 0.0
        print(f"\n{tokens} output tokens | {speed:.1f} tokens/s | first token {ttft:.2f}s")
    else:
        print(f"\nServer did not report token usage ({chunks} stream chunks). First token {ttft:.2f}s.")
    if finish_reason == "length":
        print("Response hit --max-tokens; increase it to see the final answer.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
