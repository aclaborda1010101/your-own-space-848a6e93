#!/usr/bin/env python3
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Users/potus/.openclaw/workspace')
APP = ROOT / 'jarvis-lovable-app'
PUBLIC = APP / 'public'
PUBLIC.mkdir(parents=True, exist_ok=True)
OUT = PUBLIC / 'openclaw-snapshot.json'

NODES = [
    {
        'id': 'potus', 'name': 'POTUS', 'role': 'Coordinador / routing', 'host': 'Mac Mini M4 · 192.168.1.55',
        'kind': 'local', 'config': '/Users/potus/.openclaw/openclaw.json', 'status_cmd': 'openclaw gateway status'
    },
    {
        'id': 'jarvis', 'name': 'JARVIS', 'role': 'Audio + comunicaciones', 'host': 'LAN · 192.168.1.107',
        'kind': 'windows', 'ssh': 'aclab@192.168.1.107', 'config': r'C:\Users\aclab\.openclaw\openclaw.json', 'status_cmd': 'cmd /c openclaw gateway status'
    },
    {
        'id': 'atlas', 'name': 'ATLAS', 'role': 'Film DB + GPU', 'host': 'LAN · 192.168.1.45',
        'kind': 'windows', 'ssh': 'aclab@192.168.1.45', 'config': r'C:\Users\aclab\.openclaw\openclaw.json', 'status_cmd': 'cmd /c openclaw gateway status'
    },
    {
        'id': 'titan', 'name': 'TITAN', 'role': 'Frames + desarrollo', 'host': 'LAN · 192.168.1.72',
        'kind': 'mac', 'ssh': 'agustincifuenteslaborda@192.168.1.72', 'config': '~/.openclaw/openclaw.json',
        'status_cmd': 'export PATH=/Users/agustincifuenteslaborda/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin; /Users/agustincifuenteslaborda/.nvm/versions/node/v22.22.0/bin/openclaw gateway status'
    },
]

MOCK_COSTS = {
  'day': {'totalCostEur': 8.74, 'totalTokens': 1824000, 'totalCalls': 214, 'avgCostPerCall': 0.0408,
          'models': [
              {'model':'Claude Sonnet 4.6','provider':'Anthropic','inputTokens':412000,'outputTokens':133000,'totalCostEur':3.92,'calls':48},
              {'model':'DeepSeek v3.2','provider':'DeepSeek','inputTokens':503000,'outputTokens':188000,'totalCostEur':1.46,'calls':92},
              {'model':'Gemini Flash','provider':'Google','inputTokens':351000,'outputTokens':124000,'totalCostEur':0.86,'calls':43},
              {'model':'Whisper','provider':'OpenAI','inputTokens':287000,'outputTokens':0,'totalCostEur':0.62,'calls':19},
              {'model':'Embeddings','provider':'OpenAI','inputTokens':0,'outputTokens':0,'totalCostEur':1.88,'calls':12},
          ]},
  'week': {'totalCostEur': 51.37, 'totalTokens': 11942000, 'totalCalls': 1426, 'avgCostPerCall': 0.0360,
           'models': [
              {'model':'Claude Sonnet 4.6','provider':'Anthropic','inputTokens':2850000,'outputTokens':1024000,'totalCostEur':21.84,'calls':331},
              {'model':'DeepSeek v3.2','provider':'DeepSeek','inputTokens':3112000,'outputTokens':1180000,'totalCostEur':8.92,'calls':602},
              {'model':'Gemini Flash','provider':'Google','inputTokens':2240000,'outputTokens':701000,'totalCostEur':4.31,'calls':261},
              {'model':'Whisper','provider':'OpenAI','inputTokens':1010000,'outputTokens':0,'totalCostEur':3.65,'calls':137},
              {'model':'Embeddings','provider':'OpenAI','inputTokens':0,'outputTokens':0,'totalCostEur':12.65,'calls':95},
           ]},
  'month': {'totalCostEur': 228.64, 'totalTokens': 54330000, 'totalCalls': 6240, 'avgCostPerCall': 0.0366,
            'models': [
              {'model':'Claude Sonnet 4.6','provider':'Anthropic','inputTokens':12460000,'outputTokens':4540000,'totalCostEur':97.33,'calls':1498},
              {'model':'DeepSeek v3.2','provider':'DeepSeek','inputTokens':14900000,'outputTokens':5210000,'totalCostEur':38.12,'calls':2742},
              {'model':'Gemini Flash','provider':'Google','inputTokens':10760000,'outputTokens':3510000,'totalCostEur':20.21,'calls':1118},
              {'model':'Whisper','provider':'OpenAI','inputTokens':4080000,'outputTokens':0,'totalCostEur':14.78,'calls':544},
              {'model':'Embeddings','provider':'OpenAI','inputTokens':0,'outputTokens':0,'totalCostEur':58.20,'calls':338},
            ]},
}

def sh(cmd):
    return subprocess.run(cmd, shell=True, text=True, capture_output=True, errors='ignore')

def local_config_model(path):
    try:
        data = json.loads(Path(path).read_text())
        return data.get('agents', {}).get('defaults', {}).get('model', {}).get('primary') or 'unknown'
    except Exception:
        return 'unknown'

def ssh_read_json(ssh_target, config_path):
    if ':' in config_path or '\\' in config_path:
        cmd = f"ssh -o BatchMode=yes -o ConnectTimeout=8 {ssh_target} \"powershell -NoProfile -Command \\\"$j=Get-Content '{config_path}' -Raw | ConvertFrom-Json; $j.agents.defaults.model.primary\\\"\""
    else:
        cmd = f"ssh -o BatchMode=yes -o ConnectTimeout=8 {ssh_target} \"python3 - <<'PY'\nimport json\nfrom pathlib import Path\np=Path('{config_path}'.replace('~', str(Path.home())))\nprint(json.loads(p.read_text()).get('agents',{{}}).get('defaults',{{}}).get('model',{{}}).get('primary','unknown'))\nPY\""
    r = sh(cmd)
    return (r.stdout or '').strip().splitlines()[-1] if r.returncode == 0 and (r.stdout or '').strip() else 'unknown'

def node_status(node):
    if node['kind'] == 'local':
        model = local_config_model(node['config'])
        r = sh(node['status_cmd'])
    else:
        model = ssh_read_json(node['ssh'], node['config'])
        r = sh(f"ssh -o BatchMode=yes -o ConnectTimeout=8 {node['ssh']} \"{node['status_cmd']}\"")
    out = (r.stdout or '') + '\n' + (r.stderr or '')
    ok = ('RPC probe: ok' in out) or ('Probe no' not in out and 'Dashboard:' in out and r.returncode == 0)
    status = 'healthy' if ok else 'critical'
    if 'Port 18789 is already in use' in out or 'warning' in out.lower():
        status = 'warning' if ok else 'critical'
    last_seen = 'ahora' if ok else 'sin respuesta'
    return {
        'id': node['id'], 'name': node['name'], 'role': node['role'], 'host': node['host'],
        'model': model, 'status': status, 'load': 0, 'queue': 0, 'lastSeen': last_seen,
        'detail': out[:1500].strip(),
    }

def parse_tasks():
    path = ROOT / 'TASKS.md'
    if not path.exists():
        return []
    text = path.read_text(errors='ignore').splitlines()
    tasks = []
    current = None
    for line in text:
        m = re.match(r'^### \[(OPEN|IN_PROGRESS|BLOCKED|DONE)\] (.+)$', line.strip())
        if m:
            if current: tasks.append(current)
            st, title = m.groups()
            map_status = {'OPEN':'en cola','IN_PROGRESS':'en curso','BLOCKED':'bloqueada','DONE':'lista'}
            current = {'id': f'tsk-{len(tasks)+1:03d}', 'title': title, 'owner': 'POTUS', 'priority': 'media', 'status': map_status[st], 'eta': '', 'detail': '', 'createdAt': 'workspace', 'scope': 'workspace', 'nextStep': ''}
            continue
        if current and line.strip().startswith('- Objetivo:'):
            current['detail'] = line.split(':',1)[1].strip()
        if current and line.strip().startswith('- Siguiente acción:'):
            current['nextStep'] = line.split(':',1)[1].strip()
    if current: tasks.append(current)
    return tasks[:12]

def build_runs(agents):
    runs=[]
    for idx, a in enumerate(agents, start=1):
        runs.append({
            'id': f'run-{idx}',
            'flow': 'openclaw.gateway.healthcheck',
            'node': a['name'],
            'status': 'running' if a['status'] == 'healthy' else a['status'],
            'startedAt': datetime.now().strftime('%H:%M'),
            'duration': 'live',
            'detail': a.get('detail','')[:180] or 'Sin detalle',
        })
    return runs

def build_health(agents):
    bad = [a for a in agents if a['status'] != 'healthy']
    return [
        {'label':'Gateway cluster','value':'Online' if len(bad) == 0 else f'{len(bad)} con incidencia','status':'healthy' if len(bad)==0 else 'warning','note':'Estado agregado de los 4 nodos'},
        {'label':'Nodos vivos','value':f"{sum(1 for a in agents if a['status']=='healthy')}/{len(agents)}",'status':'healthy' if len(bad)==0 else 'warning','note':'Probe real del gateway'},
        {'label':'Último snapshot','value':datetime.now().strftime('%H:%M:%S'),'status':'healthy','note':'Actualización local del dashboard'},
    ]

agents = [node_status(n) for n in NODES]
for a in agents:
    a['queue'] = sum(1 for t in parse_tasks() if t.get('owner') == a['name'] and t['status'] in ('en cola','en curso'))
snapshot = {
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'source': 'local-gateway-snapshot',
    'agents': agents,
    'tasks': parse_tasks(),
    'runs': build_runs(agents),
    'health': build_health(agents),
    'costByPeriod': MOCK_COSTS,
}
OUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + '\n')
print(str(OUT))
