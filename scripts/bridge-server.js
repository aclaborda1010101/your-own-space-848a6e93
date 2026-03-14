#!/usr/bin/env node

import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const PORT = 8788;
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SNAPSHOT_PATH = join(REPO_ROOT, 'public', 'openclaw-snapshot.json');

const SUPABASE_URL = 'https://xfjlwxssxfvhbiytcoar.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ';

async function syncNodesToSupabase(agents) {
  if (!agents || !agents.length) return;
  try {
    for (const agent of agents) {
      const status = agent.status === 'healthy' ? 'online' : agent.status === 'critical' ? 'offline' : 'degraded';
      const body = JSON.stringify({
        node_id: agent.id,
        status,
        last_heartbeat: new Date().toISOString(),
        active_workers: agent.queue || 0,
        current_load: { load: agent.load, queue: agent.queue, detail: agent.detail },
        metadata: { name: agent.name, role: agent.role, host: agent.host, model: agent.model, lastSeen: agent.lastSeen },
      });
      await fetch(`${SUPABASE_URL}/rest/v1/cloudbot_nodes?node_id=eq.${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
        body,
      });
      // Si no existe, insertar
      await fetch(`${SUPABASE_URL}/rest/v1/cloudbot_nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body,
      });
    }
    console.log(`[${new Date().toLocaleTimeString()}] cloudbot_nodes sincronizado (${agents.length} nodos)`);
  } catch (err) {
    console.error('Error sync Supabase cloudbot_nodes:', err.message);
  }
}

async function generateSnapshot() {
  try {
    await execAsync(`node ${join(REPO_ROOT, 'scripts', 'generate-snapshot.js')}`, { cwd: REPO_ROOT });
    // Sync agents to Supabase after each snapshot
    try {
      const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
      await syncNodesToSupabase(snap.agents || []);
    } catch {}
  } catch (err) {
    console.error('Error generando snapshot:', err.message);
  }
}

// Generar snapshot inicial
generateSnapshot();

// Actualizar cada 15 segundos
setInterval(generateSnapshot, 15000);

const server = createServer(async (req, res) => {
  const { method, url } = req;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Endpoint snapshot
  if (url.startsWith('/api/openclaw/snapshot')) {
    try {
      const data = readFileSync(SNAPSHOT_PATH, 'utf8');
      const snapshot = JSON.parse(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Snapshot no disponible' }));
    }
    return;
  }

  // Endpoint de operaciones REAL
  if (url === '/api/openclaw/op' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { node, action } = JSON.parse(body);
        const nodeConfig = {
          potus:  { local: true },
          jarvis: { host: 'aclab@192.168.1.20' },
          titan:  { host: 'agustincifuenteslaborda@192.168.1.72' },
          atlas:  { host: 'user@192.168.1.45' },
        };
        const cfg = nodeConfig[node?.toLowerCase()];
        if (!cfg) throw new Error(`Nodo desconocido: ${node}`);

        let cmd;
        if (action === 'restart') {
          cmd = cfg.local
            ? 'openclaw gateway restart'
            : `ssh -o BatchMode=yes -o ConnectTimeout=10 ${cfg.host} "openclaw gateway restart"`;
        } else if (action === 'restore') {
          cmd = cfg.local
            ? 'openclaw gateway stop && sleep 2 && openclaw gateway start'
            : `ssh -o BatchMode=yes -o ConnectTimeout=10 ${cfg.host} "openclaw gateway stop && sleep 2 && openclaw gateway start"`;
        } else {
          throw new Error(`Acción no soportada: ${action}`);
        }

        const { stdout, stderr } = await execAsync(cmd, { timeout: 20000 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true, action, node,
          message: `${action} ${node} ejecutado`,
          output: (stdout + stderr).trim().slice(0, 500),
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Endpoint cambio de modelo
  if (url === '/api/openclaw/model' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { node, model } = JSON.parse(body);
        if (!node || !model) throw new Error('node y model requeridos');
        // Mapa de modelos a provider/model de openclaw
        const MODEL_MAP = {
          'claude-sonnet-4-6': 'anthropic/claude-sonnet-4-6',
          'deepseek-reasoner': 'custom-api-deepseek-com/deepseek-reasoner',
          'gemini-flash': 'google/gemini-flash-1.5',
          'qwen-2.5-coder': 'openrouter/qwen/qwen-2.5-coder-32b-instruct',
          'gpt-4o': 'openai/gpt-4o',
        };
        const fullModel = MODEL_MAP[model] || model;
        if (node.toLowerCase() === 'potus') {
          // Cambiar modelo local via openclaw CLI
          const { stdout } = await execAsync(`openclaw model set ${fullModel}`, { timeout: 10000 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, node, model: fullModel, message: `POTUS usa ahora ${fullModel}`, output: stdout.trim() }));
        } else {
          // Cambiar en nodo remoto via SSH
          const hosts = { jarvis: 'aclab@192.168.1.20', titan: 'agustincifuenteslaborda@192.168.1.72', atlas: 'user@192.168.1.45' };
          const host = hosts[node.toLowerCase()];
          if (!host) throw new Error(`Nodo desconocido: ${node}`);
          const { stdout } = await execAsync(`ssh -o BatchMode=yes -o ConnectTimeout=10 ${host} "openclaw model set ${fullModel}"`, { timeout: 15000 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, node, model: fullModel, message: `${node} usa ahora ${fullModel}`, output: stdout.trim() }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Endpoint aprobaciones pendientes
  if (url === '/api/openclaw/approvals' && method === 'GET') {
    try {
      const { stdout } = await execAsync('openclaw approvals list --json 2>/dev/null || echo "[]"', { timeout: 8000 });
      let approvals = [];
      try { approvals = JSON.parse(stdout.trim()); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, approvals }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, approvals: [] }));
    }
    return;
  }

  // Endpoint aprobar/rechazar
  if (url === '/api/openclaw/approve' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, decision } = JSON.parse(body); // decision: allow-once | allow-always | deny
        if (!id || !decision) throw new Error('id y decision requeridos');
        const { stdout, stderr } = await execAsync(`openclaw approve ${id} ${decision}`, { timeout: 10000 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id, decision, output: (stdout + stderr).trim() }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
});

server.listen(PORT, () => {
  console.log(`Bridge server running on http://localhost:${PORT}`);
});