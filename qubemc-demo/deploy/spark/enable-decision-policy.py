#!/usr/bin/env python3
"""Allow only local D1 decisions from the NemoClaw sandbox's Node runtime."""
import json
import os
import subprocess
import tempfile

result = subprocess.run(['openshell', 'policy', 'get', 'cofloor', '--base', '-o', 'json'], check=True, capture_output=True, text=True)
policy = json.loads(result.stdout)['policy']
policy['network_policies']['cofloor_decision'] = {
    'name': 'cofloor_decision',
    'binaries': [{'path': '/usr/local/bin/node'}],
    'endpoints': [{
        'host': '100.89.121.112', 'port': 8001,
        'protocol': 'rest', 'enforcement': 'enforce',
        'allowed_ips': ['100.89.121.112/32'],
        'rules': [{'allow': {'method': 'POST', 'path': '/v1/systemone'}}],
    }],
}
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    json.dump(policy, f)
    filename = f.name
try:
    subprocess.run(['openshell', 'policy', 'set', 'cofloor', '--policy', filename, '--wait'], check=True)
finally:
    os.unlink(filename)
