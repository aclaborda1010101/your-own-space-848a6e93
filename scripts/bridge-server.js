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

async function generateSnapshot() {
  try {
    await execAsync(`node ${join(REPO_ROOT, 'scripts', 'generate-snapshot.js')}`, { cwd: REPO_ROOT });
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

  // Endpoint de operaciones (placeholder)
  if (url === '/api/openclaw/op' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { node, action } = JSON.parse(body);
        // Simular ejecución real: podemos ejecutar comandos SSH o local
        // Por ahora placeholder
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          action,
          node,
          mode: 'bridge-real',
          message: `${action} ${node} lanzado (simulación)`,
          next: 'Conectar esta función al gateway OpenClaw para ejecución real',
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
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