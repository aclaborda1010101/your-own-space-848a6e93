import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NodeId = "potus" | "jarvis" | "atlas" | "titan";
type Action = "status" | "restart" | "restore";

interface ReqBody {
  action: Action;
  node: NodeId;
}

const BRIDGE_URL = "http://192.168.1.10:8788";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as ReqBody;
    const { action, node } = body;

    if (!action || !node) return json({ error: "action and node required" }, 400);

    // Forward to real POTUS bridge
    try {
      const res = await fetch(`${BRIDGE_URL}/api/openclaw/op`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, node }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`Bridge responded ${res.status}`);
      const data = await res.json();
      return json({ ...data, source: "bridge-real" });
    } catch (bridgeErr) {
      // Bridge not reachable (user is remote) - return informative response
      return json({
        ok: false,
        action,
        node,
        source: "bridge-unreachable",
        message: `Bridge POTUS (192.168.1.10:8788) no alcanzable. Para ejecutar ${action} en ${node}, conéctate a la red local o usa el dashboard en red local.`,
        error: bridgeErr instanceof Error ? bridgeErr.message : "unknown",
      });
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
