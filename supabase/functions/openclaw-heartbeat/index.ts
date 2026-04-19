// OpenClaw Heartbeat — endpoint LIVE de ingest para nodos POTUS/TITAN.
// Marca el nodo como bridge_live=true en cuanto reporta por aquí.
//
// POST /openclaw-heartbeat
// Body: {
//   node_name: "POTUS" | "TITAN",
//   user_id: string,                       // a qué usuario pertenece este nodo
//   model?: string,                        // opcional: modelo activo reportado por el nodo
//   tokens_used?: number,                  // tokens consumidos en este ciclo
//   status?: "online" | "idle" | "running",
//   log?: { task_id?: string, level?: "info"|"warn"|"error", message: string, output?: string },
//   secret: string                         // shared secret OPENCLAW_BRIDGE_SECRET
// }
// Idempotente. Sin auth de usuario (los nodos son procesos físicos, no usuarios web).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      node_name,
      user_id,
      model,
      tokens_used = 0,
      status = "online",
      log,
      secret,
    } = body ?? {};

    const expected = Deno.env.get("OPENCLAW_BRIDGE_SECRET");
    if (!expected || secret !== expected) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!node_name || !user_id) {
      return json({ error: "node_name and user_id required" }, 400);
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
      .eq("name", node_name)
      .maybeSingle();

    if (nErr) return json({ error: nErr.message }, 500);
    if (!node) return json({ error: `node ${node_name} not found for user` }, 404);

    // 2) Calcular tokens hoy
    const today = new Date().toISOString().slice(0, 10);
    const tokensTodayBase =
      node.tokens_today_date === today ? node.tokens_today : 0;

    // 3) Update con marca bridge_live=true (esto es lo que la UI lee como Live)
    const newMetadata = { ...(node.metadata || {}), bridge_live: true, last_source: "bridge" };
    const update: Record<string, unknown> = {
      status,
      last_seen_at: new Date().toISOString(),
      tokens_today: tokensTodayBase + tokens_used,
      tokens_today_date: today,
      tokens_total: (node.tokens_total || 0) + tokens_used,
      metadata: newMetadata,
    };
    // Solo actualizamos modelo si el nodo lo reporta — y guardamos el anterior por trazabilidad.
    // (No se sobreescribe sin permiso si el usuario eligió uno: el bridge puede mandarlo o no.)
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
        tokens_used,
        output: log.output ?? log.message,
        error: log.level === "error" ? log.message : null,
        finished_at: new Date().toISOString(),
      });
    }

    return json({ ok: true, node_id: node.id, bridge_live: true });
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
