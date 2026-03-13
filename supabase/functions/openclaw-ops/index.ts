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

const NODES: Record<NodeId, { ssh?: string; kind: "local" | "windows" | "mac" }> = {
  potus: { kind: "local" },
  jarvis: { kind: "windows", ssh: "aclab@192.168.1.107" },
  atlas: { kind: "windows", ssh: "aclab@192.168.1.45" },
  titan: { kind: "mac", ssh: "agustincifuenteslaborda@192.168.1.72" },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, node } = await req.json() as ReqBody;
    if (!action || !node || !NODES[node]) return json({ error: "action and valid node required" }, 400);

    // Placeholder bridge contract. Real execution stays on POTUS for now.
    // This function is the stable API surface the app can call.
    return json({
      ok: true,
      action,
      node,
      mode: "bridge-placeholder",
      message: action === "status"
        ? `Status bridge listo para ${node}`
        : action === "restart"
          ? `Restart bridge listo para ${node}`
          : `Restore bridge listo para ${node}`,
      next: "Conectar esta function al bridge de POTUS/OpenClaw para ejecución real",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
