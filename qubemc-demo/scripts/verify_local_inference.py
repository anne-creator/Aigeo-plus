#!/usr/bin/env python3
"""Run on the Spark. Emit a sanitized hardware/route/inference evidence report."""
import json
from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess
import uuid
from urllib.request import ProxyHandler, build_opener

SPARK = "http://100.89.121.112:8000"
http = build_opener(ProxyHandler({}))
env = dict(os.environ)
env["PATH"] = f"{Path.home()}/.local/bin:{Path.home()}/.nvm/versions/node/v22.23.4/bin:{env.get('PATH', '')}"
env["NEMOCLAW_DISABLE_TELEMETRY"] = "1"

def command(args):
    result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=240)
    if result.returncode:
        raise RuntimeError(f"Verification command failed: {args[0]} (exit {result.returncode}); inspect locally")
    return result.stdout

def successes():
    with http.open(SPARK + "/metrics", timeout=10) as response:
        lines = response.read().decode().splitlines()
    return sum(float(line.rsplit(' ', 1)[1]) for line in lines if line.startswith('vllm:request_success_total{'))

backend = (Path.home()/'.nemoclaw/ollama-backend').read_text().strip()
assert backend in ('http://localhost:18000', 'http://127.0.0.1:18000'), 'Unexpected proxy backend'
container = json.loads(command(['docker', 'inspect', 'spark-llm']))[0]
assert container['State']['Running'], 'Local vLLM container is not running'
ports = container['NetworkSettings']['Ports']['8000/tcp']
assert {'HostIp':'100.89.121.112','HostPort':'8000'} in ports, 'Unexpected model port binding'
gpu = command(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader']).strip()
assert container['HostConfig']['DeviceRequests'], 'Container has no GPU device request'
probe = """const fs=require('fs');const c=JSON.parse(fs.readFileSync('/sandbox/.openclaw/cofloor-planner.json'));console.log(JSON.stringify({providerUrl:c.models.providers.inference.baseUrl,providers:Object.keys(c.models.providers),primary:c.agents.defaults.model.primary,fallbacks:c.agents.defaults.model.fallbacks||[]}));"""
planner = json.loads(command(['nemoclaw', 'cofloor', 'exec', '--', 'node', '-e', probe]))
assert planner == {'providerUrl':'https://inference.local/v1','providers':['inference'],'primary':'inference/coo-llm','fallbacks':[]}, 'Unexpected planner route'
with http.open(SPARK + '/v1/models', timeout=10) as response:
    models = [m['id'] for m in json.load(response)['data']]
assert 'coo-llm' in models
before = successes()
nonce = 'local-spark-' + uuid.uuid4().hex
result = json.loads(command(['nemoclaw', 'cofloor', 'exec', '--', 'openclaw', 'agent', 'exec', '--config', '/sandbox/.openclaw/cofloor-planner.json', '--thinking', 'off', '--timeout', '180', '--json', 'Return only this JSON object: ' + json.dumps({'proof':nonce})]))
assert result.get('ok') and result.get('provider') == 'inference' and result.get('model') == 'coo-llm', 'Unexpected inference result'
assert json.loads(result['final']) == {'proof':nonce}, 'Nonce response mismatch'
after = successes()
assert after > before, 'No corresponding completed inference at the local vLLM server'
print(json.dumps({'verified':True,'verifiedAtUtc':datetime.now(timezone.utc).isoformat(),'gpu':gpu,'container':'spark-llm','image':container['Config']['Image'],'tailscaleEndpoint':SPARK,'models':models,'planner':planner,'hostProxyBackend':backend,'localCompletedRequestsBefore':before,'localCompletedRequestsAfter':after,'nonceRoundTrip':True,'agentProvider':result['provider'],'agentModel':result['model']},indent=2))
