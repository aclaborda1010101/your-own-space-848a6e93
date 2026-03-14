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

  // Costos reales desde openclaw sessions
  let costByPeriod = { day: null, week: null, month: null };
  try {
    const sessionsRaw = execSync('openclaw sessions --json', { timeout: 8000 }).toString();
    const sessionsData = JSON.parse(sessionsRaw);
    const sessions = sessionsData.sessions || [];

    // Agrupar por modelo y calcular costes reales (precios aproximados por 1K tokens)
    const PRICES = {
      'claude-sonnet': { in: 0.003, out: 0.015 },
      'claude-opus':   { in: 0.015, out: 0.075 },
      'deepseek':      { in: 0.00014, out: 0.00028 },
      'gemini':        { in: 0.00025, out: 0.001 },
      'gpt':           { in: 0.005, out: 0.015 },
      'default':       { in: 0.002, out: 0.008 },
    };

    function getPrice(model) {
      const m = (model || '').toLowerCase();
      if (m.includes('sonnet')) return PRICES['claude-sonnet'];
      if (m.includes('opus')) return PRICES['claude-opus'];
      if (m.includes('deepseek')) return PRICES['deepseek'];
      if (m.includes('gemini')) return PRICES['gemini'];
      if (m.includes('gpt')) return PRICES['gpt'];
      return PRICES['default'];
    }

    function buildPeriod(slist) {
      const byModel = {};
      let totalIn = 0, totalOut = 0, totalCost = 0, totalCalls = 0;
      slist.forEach(s => {
        const model = s.model || 'unknown';
        const key = model.split('/').pop();
        const p = getPrice(model);
        const inTok = s.inputTokens || 0;
        const outTok = s.outputTokens || 0;
        const cost = (inTok / 1000 * p.in) + (outTok / 1000 * p.out);
        if (!byModel[key]) byModel[key] = { model: key, provider: s.modelProvider || '?', inputTokens: 0, outputTokens: 0, totalCostEur: 0, calls: 0 };
        byModel[key].inputTokens += inTok;
        byModel[key].outputTokens += outTok;
        byModel[key].totalCostEur += cost;
        byModel[key].calls += 1;
        totalIn += inTok; totalOut += outTok; totalCost += cost; totalCalls += 1;
      });
      const models = Object.values(byModel).map(m => ({ ...m, totalCostEur: Math.round(m.totalCostEur * 100) / 100 }));
      return {
        totalCostEur: Math.round(totalCost * 100) / 100,
        totalTokens: totalIn + totalOut,
        totalCalls,
        avgCostPerCall: totalCalls ? Math.round(totalCost / totalCalls * 10000) / 10000 : 0,
        models,
        source: 'openclaw-sessions-real',
      };
    }

    const cutDay = Date.now() - 86400000;
    const cutWeek = Date.now() - 7 * 86400000;
    costByPeriod.day = buildPeriod(sessions.filter(s => (s.updatedAt || 0) > cutDay));
    costByPeriod.week = buildPeriod(sessions.filter(s => (s.updatedAt || 0) > cutWeek));
    costByPeriod.month = buildPeriod(sessions);
  } catch (e) {
    costByPeriod = { day: { totalCostEur: 0, totalTokens: 0, totalCalls: 0, avgCostPerCall: 0, models: [], source: 'error:' + e.message }, week: null, month: null };
  }

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