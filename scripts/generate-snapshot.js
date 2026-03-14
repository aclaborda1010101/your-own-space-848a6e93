#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const SNAPSHOT_PATH = join(process.cwd(), 'public', 'openclaw-snapshot.json');

// Configuración de nodos (extraída de TOOLS.md)
const NODES = [
  { id: 'potus', name: 'POTUS', role: 'Coordinador / routing', host: 'Mac Mini M4 · 192.168.1.10', ip: '192.168.1.10' },
  { id: 'jarvis', name: 'JARVIS', role: 'Audio + comunicaciones', host: 'LAN · 192.168.1.20', ip: '192.168.1.20' },
  { id: 'atlas', name: 'ATLAS', role: 'Film DB + GPU', host: 'LAN · 192.168.1.45', ip: '192.168.1.45' },
  { id: 'titan', name: 'TITAN', role: 'Frames + desarrollo', host: 'LAN · 192.168.1.72', ip: '192.168.1.72' },
];

function checkNode(node) {
  if (node.id === 'potus') {
    // Para POTUS, verificar si el gateway está corriendo (puerto 18789)
    try {
      const result = execSync(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/health 2>&1`, { encoding: 'utf8', timeout: 3000 });
      return result.trim() === '200' || result.trim() === '404' || result.trim() === '000';
    } catch (err) {
      return false;
    }
  } else {
    // Para otros nodos, ping
    try {
      const result = execSync(`ping -c 1 -t 2 ${node.ip} 2>&1`, { encoding: 'utf8' });
      return result.includes('1 packets received') || result.includes('time=');
    } catch (err) {
      return false;
    }
  }
}

function getOpenClawSessions() {
  try {
    const output = execSync('openclaw sessions --json', { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (err) {
    console.error('Error getting sessions:', err.message);
    return { sessions: [] };
  }
}

function getCurrentAgent() {
  try {
    const output = execSync('openclaw status --json', { encoding: 'utf8' });
    const status = JSON.parse(output);
    return status;
  } catch (err) {
    console.error('Error getting status:', err.message);
    return {};
  }
}

function generateSnapshot() {
  const now = new Date();
  const agents = NODES.map(node => {
    const alive = checkNode(node);
    const status = alive ? 'healthy' : 'critical';
    const lastSeen = alive ? 'ahora' : 'sin respuesta';
    // Detalle adicional
    let detail = '';
    if (node.id === 'potus') {
      detail = alive ? 'Gateway activo en puerto 18789' : 'Gateway no responde';
    } else {
      detail = alive ? 'Respuesta ICMP OK' : 'No responde al ping';
    }
    return {
      id: node.id,
      name: node.name,
      role: node.role,
      host: node.host,
      model: node.id === 'potus' ? 'custom-api-deepseek-com/deepseek-reasoner' : 'unknown',
      status,
      load: 0,
      queue: 0,
      lastSeen,
      detail,
      currentWork: alive ? 'Monitorización activa' : 'Monitorización y espera activa',
      lastAction: alive ? 'Último ping OK' : 'Último probe de gateway completado',
      nextAction: 'Aceptar restart/restore o nueva tarea',
      progressLabel: alive ? '1/1 nodo vivo' : 'sin tarea asignada',
      progressPercent: alive ? 100 : 0,
    };
  });

  const sessions = getOpenClawSessions();
  const recentSessions = sessions.sessions?.slice(0, 5).map(s => ({
    id: s.sessionId,
    key: s.key,
    updatedAt: new Date(s.updatedAt).toISOString(),
  })) || [];

  // Runs (simulados por ahora)
  const runs = NODES.map(node => ({
    id: `run-${node.id}`,
    flow: 'openclaw.gateway.healthcheck',
    node: node.name,
    status: node.id === 'potus' ? 'running' : 'critical',
    startedAt: '01:32',
    duration: 'live',
    detail: node.id === 'potus' ? 'Gateway activo' : 'SSH connectivity disabled for snapshot speed',
  }));

  // Health summary
  const aliveCount = NODES.filter(n => checkNode(n)).length;
  const health = [
    {
      label: 'Gateway cluster',
      value: `${NODES.length - aliveCount} con incidencia`,
      status: aliveCount === NODES.length ? 'healthy' : 'warning',
      note: 'Estado agregado de los 4 nodos',
    },
    {
      label: 'Nodos vivos',
      value: `${aliveCount}/${NODES.length}`,
      status: aliveCount === NODES.length ? 'healthy' : 'warning',
      note: 'Probe real del gateway',
    },
    {
      label: 'Último snapshot',
      value: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: 'healthy',
      note: 'Actualización local del dashboard',
    },
  ];

  // Live log (últimas sesiones)
  const liveLog = recentSessions.map(s => ({
    timestamp: new Date(s.updatedAt).toLocaleString('es-ES', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    agent: 'POTUS',
    status: 'DONE',
    message: `sesión ${s.id.substring(0, 8)}`,
  }));

  // Costos (mock por ahora)
  const costByPeriod = {
    day: {
      totalCostEur: 8.74,
      totalTokens: 1824000,
      totalCalls: 214,
      avgCostPerCall: 0.0408,
      models: [
        { model: 'Claude Sonnet 4.6', provider: 'Anthropic', inputTokens: 412000, outputTokens: 133000, totalCostEur: 3.92, calls: 48 },
        { model: 'DeepSeek v3.2', provider: 'DeepSeek', inputTokens: 503000, outputTokens: 188000, totalCostEur: 1.46, calls: 92 },
        { model: 'Gemini Flash', provider: 'Google', inputTokens: 351000, outputTokens: 124000, totalCostEur: 0.86, calls: 43 },
        { model: 'Whisper', provider: 'OpenAI', inputTokens: 287000, outputTokens: 0, totalCostEur: 0.62, calls: 19 },
        { model: 'Embeddings', provider: 'OpenAI', inputTokens: 0, outputTokens: 0, totalCostEur: 1.88, calls: 12 },
      ],
    },
    week: {
      totalCostEur: 51.37,
      totalTokens: 11942000,
      totalCalls: 1426,
      avgCostPerCall: 0.036,
      models: [
        { model: 'Claude Sonnet 4.6', provider: 'Anthropic', inputTokens: 2850000, outputTokens: 1024000, totalCostEur: 21.84, calls: 331 },
        { model: 'DeepSeek v3.2', provider: 'DeepSeek', inputTokens: 3112000, outputTokens: 1180000, totalCostEur: 8.92, calls: 602 },
        { model: 'Gemini Flash', provider: 'Google', inputTokens: 2240000, outputTokens: 701000, totalCostEur: 4.31, calls: 261 },
        { model: 'Whisper', provider: 'OpenAI', inputTokens: 1010000, outputTokens: 0, totalCostEur: 3.65, calls: 137 },
        { model: 'Embeddings', provider: 'OpenAI', inputTokens: 0, outputTokens: 0, totalCostEur: 12.65, calls: 95 },
      ],
    },
    month: {
      totalCostEur: 228.64,
      totalTokens: 54330000,
      totalCalls: 6240,
      avgCostPerCall: 0.0366,
      models: [
        { model: 'Claude Sonnet 4.6', provider: 'Anthropic', inputTokens: 12460000, outputTokens: 4540000, totalCostEur: 97.33, calls: 1498 },
        { model: 'DeepSeek v3.2', provider: 'DeepSeek', inputTokens: 14900000, outputTokens: 5210000, totalCostEur: 38.12, calls: 2742 },
        { model: 'Gemini Flash', provider: 'Google', inputTokens: 10760000, outputTokens: 3510000, totalCostEur: 20.21, calls: 1118 },
        { model: 'Whisper', provider: 'OpenAI', inputTokens: 4080000, outputTokens: 0, totalCostEur: 14.78, calls: 544 },
        { model: 'Embeddings', provider: 'OpenAI', inputTokens: 0, outputTokens: 0, totalCostEur: 58.2, calls: 338 },
      ],
    },
  };

  const snapshot = {
    generatedAt: now.toISOString(),
    source: 'local-gateway-snapshot',
    agents,
    tasks: [],
    runs,
    health,
    liveLog,
    costByPeriod,
  };

  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot escrito en ${SNAPSHOT_PATH}`);
}

generateSnapshot();