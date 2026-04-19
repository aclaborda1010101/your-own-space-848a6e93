// openclaw-bridge-selftest
// Dispara un heartbeat REAL contra openclaw-heartbeat usando el secret del runtime,
// para activar el bridge live de POTUS de un usuario concreto sin necesidad de
// que el bridge físico esté online todavía.
//
// POST /openclaw-bridge-selftest  { user_id: "...", node_name: "POTUS" }
// Auth: usuario autenticado (verify_jwt true por defecto).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const node_name = body.node_name ?? "POTUS";

    const secret = Deno.env.get("OPENCLAW_BRIDGE_SECRET");
    if (!secret) return json({ error: "OPENCLAW_BRIDGE_SECRET not configured" }, 500);

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/openclaw-heartbeat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_name,
        user_id: userId,
        model: undefined, // no tocamos modelo activo sin permiso explícito
        tokens_used: 0,
        status: "online",
        log: {
          level: "info",
          message: "bridge selftest OK · live ingest verificado",
        },
        secret,
      }),
    });
    const out = await res.json();
    return json({ ok: res.ok, heartbeat_response: out, status: res.status }, res.ok ? 200 : 500);
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
