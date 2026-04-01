import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseForgeError(text: string) {
  try {
    const parsed = JSON.parse(text);
    const availableActions = Array.isArray(parsed?.available_actions)
      ? parsed.available_actions.filter((action: unknown): action is string => typeof action === "string")
      : [];

    return {
      message: typeof parsed?.error === "string" ? parsed.error : text,
      availableActions,
    };
  } catch {
    return { message: text, availableActions: [] as string[] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const forgeApiKey = Deno.env.get("EXPERT_FORGE_API_KEY");
    const forgeGatewayUrl = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";
    const forgeProjectId = "5123d6ea-14aa-4f73-a547-07393d583e89";

    if (!forgeApiKey) throw new Error("EXPERT_FORGE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { run_id } = await req.json();
    if (!run_id) throw new Error("run_id required");

    // Fetch completed run
    const { data: run, error: runError } = await supabase
      .from("pattern_detector_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runError || !run) throw new Error("Run not found");
    if (run.status !== "completed") throw new Error("Run not completed");
    if (run.model_verdict !== "VALID") throw new Error("Run verdict is not VALID");

    const phaseResults = (run as any).phase_results || {};
    const documents: { content: string; metadata: Record<string, unknown> }[] = [];

    // Extract signals from Phase 5
    const phase5 = phaseResults.phase_5 || phaseResults.phase5 || {};
    const signals = phase5.signals || phase5.layers || [];
    
    if (Array.isArray(signals)) {
      for (const signal of signals) {
        const layerName = signal.layer_name || signal.layerName || `Capa ${signal.layer_id || signal.layer || "?"}`;
        const title = signal.signal_name || signal.name || signal.title || "Sin título";
        const confidence = signal.confidence || signal.confidence_score || 0;
        const description = signal.description || signal.analysis || "";
        const sources = signal.data_source || signal.sources || "";
        const counter = signal.contradicting_evidence || signal.devil_advocate_result || "N/A";

        documents.push({
          content: `PATRÓN [${layerName}] - ${title} | Confianza: ${confidence}% | ${description} | Fuentes: ${sources} | Evidencia contraria: ${counter}`,
          metadata: {
            source: "jarvis_patterns",
            run_id,
            layer: signal.layer_id || signal.layer,
            confidence,
            type: "pattern_signal",
            sector: (run as any).sector,
          },
        });
      }
    }

    // Extract hypotheses from Phase 7
    const phase7 = phaseResults.phase_7 || phaseResults.phase7 || {};
    const hypotheses = phase7.hypotheses || phase7.actionable_hypotheses || [];

    if (Array.isArray(hypotheses)) {
      for (const hyp of hypotheses) {
        const title = hyp.title || hyp.hypothesis || "Sin título";
        const roi = hyp.expected_roi || hyp.roi || "N/A";
        const impact = hyp.impact || hyp.expected_impact || "N/A";
        const blueprint = hyp.success_blueprint || hyp.action_plan || "N/A";

        documents.push({
          content: `HIPÓTESIS ACCIONABLE - ${title} | ROI estimado: ${roi} | Impacto: ${impact} | Blueprint: ${blueprint}`,
          metadata: {
            source: "jarvis_patterns",
            run_id,
            type: "hypothesis",
            sector: (run as any).sector,
          },
        });
      }
    }

    // Extract sources from Phase 2
    const phase2 = phaseResults.phase_2 || phaseResults.phase2 || {};
    const dataSources = phase2.sources || phase2.data_sources || [];

    if (Array.isArray(dataSources)) {
      for (const src of dataSources) {
        const name = src.name || src.source_name || "Fuente";
        const type = src.type || src.source_type || "";
        const reliability = src.reliability_score || src.reliability || 0;
        const url = src.url || "";

        documents.push({
          content: `FUENTE DE DATOS - ${name} | Tipo: ${type} | Fiabilidad: ${reliability}/10 | URL: ${url}`,
          metadata: {
            source: "jarvis_patterns",
            run_id,
            type: "data_source",
            sector: (run as any).sector,
          },
        });
      }
    }

    if (documents.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No documents to export", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send each document to Expert Forge
    let successCount = 0;
    const errors: string[] = [];
    let fatalError: string | null = null;

    console.log(`Sending ${documents.length} documents to Expert Forge at ${forgeGatewayUrl}`);

    for (const doc of documents) {
      if (fatalError) break;

      try {
        const resp = await fetch(forgeGatewayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": forgeApiKey },
          body: JSON.stringify({
            action: "ingest_patterns",
            project_id: forgeProjectId,
            content: doc.content,
            metadata: doc.metadata,
          }),
        });

        if (resp.ok) {
          successCount++;
        } else {
          const errText = await resp.text();
          const { message, availableActions } = parseForgeError(errText);
          const compactError = `${doc.metadata.type}: ${resp.status} - ${message}`;

          console.error(`Forge error for ${doc.metadata.type}: ${resp.status} - ${errText}`);
          errors.push(compactError.substring(0, 240));

          if (message.includes("Unknown action") && availableActions.length > 0) {
            fatalError = `Expert Forge no soporta la acción ingest_document en api-gateway. Acciones disponibles: ${availableActions.join(", ")}`;
          }
        }
      } catch (e) {
        console.error(`Forge fetch error for ${doc.metadata.type}:`, (e as Error).message);
        errors.push(`${doc.metadata.type}: ${(e as Error).message}`);
      }
    }

    console.log(`Published ${successCount}/${documents.length} documents to Expert Forge for run ${run_id}`);

    return new Response(JSON.stringify({
      success: successCount > 0,
      count: successCount,
      total: documents.length,
      error: fatalError || (successCount === 0 ? errors[0] : undefined),
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("publish-to-forge error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
