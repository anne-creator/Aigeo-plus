# Local inference: source and runtime evidence

The inference machine is the DGX Spark at Tailscale IP `100.89.121.112`.
A private IP alone does not prove where computation happens. The source route,
container GPU configuration, model identity, and an actual local inference probe
provide complementary evidence. Cloudflare serves the browser UI only in the
application's inference path; Discord is an external messaging service, not an
inference provider.

## Endpoints

| Service | Direct private endpoint | Spark container |
| --- | --- | --- |
| Nemotron LLM + speculative decoding | `http://100.89.121.112:8000/v1/chat/completions` | `spark-llm` |
| Decision model | `http://100.89.121.112:8001/v1/systemone` | `spark-decision` |
| Qwen TTS | `http://100.89.121.112:8004/v1/audio/speech` | `spark-qwen-tts` |

## Application route

```text
Browser -> Node backend on Spark
        -> nemoclaw cofloor exec -- openclaw agent exec
        -> https://inference.local/v1 (OpenShell's sandbox-local virtual route)
        -> authenticated host proxy on :11435
        -> http://localhost:18000 (host loopback relay)
        -> http://100.89.121.112:8000 (Spark vLLM container, NVIDIA GB10)
```

`inference.local` is the OpenShell gateway inside the NemoClaw environment. It is
not a public inference service. The loopback relay is necessary because the
sandbox has a separate network namespace from the host.

Source entry points:

- `server/model.mjs` defaults to the NemoClaw harness. `COFLOOR_INFERENCE=local`
  explicitly selects the direct private endpoint for diagnostics. Agent failures
  do not trigger a direct-mode or remote-provider fallback.
- `server/local-inference.mjs` pins direct inference to the Spark IP, port and
  chat-completions path, rejecting other hosts, embedded credentials and queries.
- `server/nemoclaw-discord.mjs` invokes the NemoClaw CLI for planning and Discord.
- `deploy/spark/configure-planner.cjs` pins the agent to `inference/coo-llm`, keeps
  only the local inference provider, and clears model fallbacks.
- `deploy/spark/cofloor-nemoclaw-proxy.py` accepts only the local loopback backend.
- `deploy/spark/cofloor-vllm-proxy.py` forwards only to `100.89.121.112:8000`.
- All three `scripts/test_*.py` model clients use the private endpoints above.
  `scripts/local_model_http.py` rejects different endpoints, disables HTTP
  proxies, and rejects redirects. No gateway credentials are loaded or sent.

A sanitized [recorded verification result](local-inference-evidence.json) is
included for review. It is a point-in-time observation; rerun the command below
to check the current machine.

## Reproduce the runtime check on the Spark

```sh
cd ~/cofloor/current
python3 scripts/verify_local_inference.py
```

This sends one synthetic nonce through the actual NemoClaw agent; it does not
send any Discord message or company document. It fails unless the configured
planner uses the local provider, its nonce response matches, and the local vLLM
completed-request counter increases. It also checks the running Docker container,
its Tailscale port binding and GPU device request, and reports the GPU name and
container image. Output excludes tokens, complete configs and container env vars.
Concurrent local traffic can also increase the counter, so the metric is
corroborating evidence alongside the route/config and nonce response, not a
cryptographic attestation or an isolated benchmark.

The test clients can also run from a laptop connected to the same Tailscale net:

```sh
python3 scripts/test_llm.py "Reply exactly LOCAL_SPARK_OK." --max-tokens 32
python3 scripts/test_decision.py "I was charged twice."
python3 scripts/test_qwen_tts.py "Local inference on the Spark." --output /tmp/local.wav
```

Existing public gateway credentials are not required for any of these commands.

## Fast allocation path

Nemotron still interprets the brief through the NemoClaw agent. Owner selection
uses D1's structured decision endpoint: `nemoclaw cofloor exec -- node ...`
runs a bounded request to `http://100.89.121.112:8001/v1/systemone` inside the
sandbox. `enable-decision-policy.py` adds only that IP, port, POST path and Node
binary to the existing sandbox policy; it does not change the Discord gateway
or the Nemotron inference provider. No cloud endpoint or direct-host fallback
is used. D1 chooses among coordinator-validated candidates, and the resulting
assignment is checked again against the reservations and forced Alex scenario.

Successful task proposals and owner selections are cached under
`.cofloor-runs/cache/`. The key includes the complete brief, staffing, calendars,
bookings, skills, business date, policy and selector version. Cache hits rerun
all eligibility/assignment checks. Invalid cached choices are removed and
regenerated. Each new run has independent reservations, messages, leave events,
confirmation state and narration IDs; those are never copied from the cache.

Run `node --env-file=/home/dell/cofloor/app.env scripts/benchmark_allocation.mjs`
on the Spark to compare cold NemoClaw/Nemotron + D1 allocation with a validated
cache hit. It writes isolated benchmark runs and disables Discord transport.
The output separates D1 inference time from sandbox/queue overhead and total
allocation time. Speedups are measured for this workload, not a universal claim.
