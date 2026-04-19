// OpenClaw Heartbeat — endpoint LIVE de ingest para nodos POTUS/TITAN.
// Marca el nodo como bridge_live=true en cuanto reporta por aquí.
//
// POST /openclaw-heartbeat
// Body (contrato extendido):
// {
//   // Identificación del nodo (acepta cualquiera de las dos formas):
//   node_id?: string,             // = name del nodo ("POTUS" | "TITAN")
//   node_name?: string,           // alias de node_id (compat)
//   user_id: string,              // a qué usuario pertenece este nodo
//
//   // Telemetría:
//   status?: "online" | "idle" | "running" | "offline",
//   model?: string,
//   tokens_used?: number,         // delta a sumar a tokens_today / tokens_total
//   tokens_today?: number,        // alternativo: valor absoluto del día
//   active_tasks?: number,        // nº de tareas activas reportadas
//   active_task?: string,         // título de la tarea activa
//   progress?: number,            // 0..100
//   last_seen?: string,           // ISO opcional; si falta usamos now()
//
//   // Logging opcional:
//   log?: { task_id?: string, level?: "info"|"warn"|"error", message: string, output?: string },
//
//   // Auth:
//   secret: string                // shared secret OPENCLAW_BRIDGE_SECRET
// }
//
// Idempotente. Sin auth de usuario (los nodos son procesos físicos, no usuarios web).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      node_id,
      node_name,
      user_id,
      model,
      tokens_used = 0,
      tokens_today: tokensTodayAbs,
      status = "online",
      active_tasks,
      active_task,
      progress,
      last_seen,
      log,
      secret,
    } = body ?? {};

    const expected = Deno.env.get("OPENCLAW_BRIDGE_SECRET");
    if (!expected || secret !== expected) {
      return json({ error: "unauthorized" }, 401);
    }
    const name = node_id || node_name;
    if (!name || !user_id) {
      return json({ error: "node_id (or node_name) and user_id required" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Buscar nodo del usuario por nombre
    const { data: node, error: nErr } = await sb
      .from("openclaw_nodes")
      .select("*")
      .eq("user_id", user_id)
      .eq("name", name)
      .maybeSingle();

    if (nErr) return json({ error: nErr.message }, 500);
    if (!node) return json({ error: `node ${name} not found for user` }, 404);

    // 2) Calcular tokens hoy (acepta delta o absoluto)
    const today = new Date().toISOString().slice(0, 10);
    const tokensTodayBase =
      node.tokens_today_date === today ? node.tokens_today : 0;
    const newTokensToday =
      typeof tokensTodayAbs === "number"
        ? tokensTodayAbs
        : tokensTodayBase + tokens_used;
    const tokensDelta = Math.max(0, newTokensToday - tokensTodayBase);

    // 3) Update con marca bridge_live=true (esto es lo que la UI lee como Live)
    const newMetadata = { ...(node.metadata || {}), bridge_live: true, last_source: "bridge" };
    const seenAt = last_seen ? new Date(last_seen).toISOString() : new Date().toISOString();
    const update: Record<string, unknown> = {
      status,
      last_seen_at: seenAt,
      tokens_today: newTokensToday,
      tokens_today_date: today,
      tokens_total: (node.tokens_total || 0) + tokensDelta,
      metadata: newMetadata,
    };
    if (typeof active_tasks === "number") {
      newMetadata.active_tasks = active_tasks;
    }
    if (typeof active_task === "string") {
      update.active_task = active_task;
    }
    if (typeof progress === "number") {
      update.progress = Math.max(0, Math.min(100, Math.round(progress)));
    }
    if (model && model !== node.model) {
      update.model = model;
      newMetadata.previous_model = node.model;
    }

    const { error: upErr } = await sb
      .from("openclaw_nodes")
      .update(update)
      .eq("id", node.id);
    if (upErr) return json({ error: upErr.message }, 500);

    // 4) Si llega log, registrar ejecución real
    if (log?.message) {
      await sb.from("openclaw_task_executions").insert({
        user_id,
        task_id: log.task_id ?? null,
        node_id: node.id,
        node_name: node.name,
        status: log.level === "error" ? "failed" : "done",
        source: "bridge_live",
        model_used: model ?? node.model,
        tokens_used: tokensDelta,
        output: log.output ?? log.message,
        error: log.level === "error" ? log.message : null,
        finished_at: new Date().toISOString(),
      });
    }

    return json({ ok: true, node_id: node.id, name: node.name, bridge_live: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
