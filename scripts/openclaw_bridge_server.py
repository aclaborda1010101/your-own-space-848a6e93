#!/usr/bin/env python3
import json, os, re, shutil, subprocess, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path('/Users/potus/.openclaw/workspace')
APP = ROOT / 'jarvis-lovable-app'
SNAPSHOT = APP / 'public' / 'openclaw-snapshot.json'
PORT = 8788

NODES = {
    'potus': {'kind':'local'},
    'jarvis': {'kind':'windows','ssh':'aclab@192.168.1.107'},
    'atlas': {'kind':'windows','ssh':'aclab@192.168.1.45'},
    'titan': {'kind':'mac','ssh':'agustincifuenteslaborda@192.168.1.72','path':'/Users/agustincifuenteslaborda/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','openclaw':'/Users/agustincifuenteslaborda/.nvm/versions/node/v22.22.0/bin/openclaw'},
}

def sh(cmd):
    return subprocess.run(cmd, shell=True, text=True, capture_output=True, errors='ignore')

def latest_backup(base_glob):
    items = sorted(Path().glob(base_glob), key=lambda p: p.stat().st_mtime, reverse=True)
    return items[0] if items else None

def restart_node(node):
    if node == 'potus':
        r = sh('openclaw gateway restart && sleep 2 && openclaw gateway status')
        return r.returncode == 0, (r.stdout + r.stderr)[-2000:]
    if node in ('jarvis','atlas'):
        host = NODES[node]['ssh']
        r = sh(f"ssh -o BatchMode=yes -o ConnectTimeout=8 {host} 'cmd /c openclaw gateway restart ^& timeout /t 3 /nobreak ^>nul ^& openclaw gateway status'")
        return r.returncode == 0, (r.stdout + r.stderr)[-2000:]
    if node == 'titan':
        n=NODES[node]
        r = sh(f"ssh -o BatchMode=yes -o ConnectTimeout=8 {n['ssh']} \"export PATH='{n['path']}'; {n['openclaw']} gateway restart || true; sleep 3; {n['openclaw']} gateway status\"")
        return r.returncode == 0, (r.stdout + r.stderr)[-2000:]
    return False, 'unknown node'

def restore_node(node):
    if node == 'potus':
        candidates = sorted(Path('/Users/potus/.openclaw').glob('workspace-backup-*'), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates: return False, 'no backup found'
        src = candidates[0]
        dst = Path('/Users/potus/.openclaw/workspace')
        tmp = dst.with_name('workspace.restore.tmp')
        if tmp.exists(): shutil.rmtree(tmp)
        shutil.copytree(src, tmp)
        return True, f'ready restore from {src.name} to {tmp.name} (manual promote safety)'
    if node in ('jarvis','atlas'):
        host = NODES[node]['ssh']
        cmd = r'''powershell -NoProfile -Command "$b=Get-ChildItem C:\Users\aclab\.openclaw -Directory | Where-Object {$_.Name -like 'workspace-backup-*'} | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if(-not $b){'NO_BACKUP'; exit 1}; $tmp='C:\Users\aclab\.openclaw\workspace.restore.tmp'; if(Test-Path $tmp){Remove-Item -Recurse -Force $tmp}; Copy-Item -Recurse -Force $b.FullName $tmp; Write-Output \"READY $($b.Name)\""'''
        r = sh(f"ssh -o BatchMode=yes -o ConnectTimeout=8 {host} '{cmd}'")
        return r.returncode == 0, (r.stdout + r.stderr)[-2000:]
    if node == 'titan':
        host = NODES[node]['ssh']
        cmd = r'''python3 - <<'PY'
from pathlib import Path
import shutil
base=Path.home()/'.openclaw'
backs=sorted(base.glob('workspace-backup-*'), key=lambda p:p.stat().st_mtime, reverse=True)
if not backs:
    print('NO_BACKUP'); raise SystemExit(1)
tmp=base/'workspace.restore.tmp'
if tmp.exists(): shutil.rmtree(tmp)
shutil.copytree(backs[0], tmp)
print(f'READY {backs[0].name}')
PY'''
        r = sh(f"ssh -o BatchMode=yes -o ConnectTimeout=8 {host} \"{cmd}\"")
        return r.returncode == 0, (r.stdout + r.stderr)[-2000:]
    return False, 'unknown node'

def ensure_snapshot():
    r = sh(f"cd {APP} && ./scripts/generate_openclaw_snapshot.py")
    if SNAPSHOT.exists():
        return True, SNAPSHOT.read_text(errors='ignore')
    return False, r.stderr or r.stdout

def handle_chat(message):
    msg = message.lower().strip()
    m = re.search(r'(reinicia|reactiva|activa)\s+(potus|jarvis|atlas|titan)', msg)
    if m:
        ok, out = restart_node(m.group(2))
        return {'ok': ok, 'response': out}
    m = re.search(r'(restaura|restore)\s+(potus|jarvis|atlas|titan)', msg)
    if m:
        ok, out = restore_node(m.group(2))
        return {'ok': ok, 'response': out}
    if 'estado' in msg or 'status' in msg:
        ok, out = ensure_snapshot()
        return {'ok': ok, 'response': 'Snapshot actualizado' if ok else out}
    return {'ok': True, 'response': 'POTUS bridge operativo. Puedo: reinicia [nodo], restaura [nodo], estado.'}

class H(BaseHTTPRequestHandler):
    def _send(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','content-type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def do_OPTIONS(self):
        self._send(200, {'ok':True})
    def do_GET(self):
        if self.path.startswith('/api/openclaw/snapshot'):
            ok, out = ensure_snapshot()
            if ok:
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self.send_header('Access-Control-Allow-Origin','*')
                self.end_headers()
                self.wfile.write(out.encode())
            else:
                self._send(500, {'ok':False,'error':out})
            return
        self._send(404, {'ok':False})
    def do_POST(self):
        length = int(self.headers.get('content-length','0'))
        body = json.loads(self.rfile.read(length) or b'{}')
        if self.path == '/api/openclaw/op':
            node = body.get('node'); action = body.get('action')
            if action == 'restart': ok, out = restart_node(node)
            elif action == 'restore': ok, out = restore_node(node)
            else: self._send(400, {'ok':False,'error':'bad action'}); return
            self._send(200 if ok else 500, {'ok':ok,'message':out})
            return
        if self.path == '/api/potus/chat':
            result = handle_chat(body.get('message',''))
            self._send(200 if result['ok'] else 500, result)
            return
        self._send(404, {'ok':False})

HTTPServer(('0.0.0.0', PORT), H).serve_forever()
