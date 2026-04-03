import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const { action, run_id } = body;

    // ── Proxy mode: verify / create_and_architect → forward to Expert Forge gateway ──
    if (action && action !== "ingest_patterns") {
      const proxyPayload = { ...body, project_id: body.project_id || forgeProjectId };
      console.log(`[publish-to-forge] Proxying action="${action}" to Expert Forge`);

      const resp = await fetch(forgeGatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": forgeApiKey },
        body: JSON.stringify(proxyPayload),
      });

      const respBody = await resp.text();
      return new Response(respBody, {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pattern export mode: requires run_id ──
    if (!run_id || typeof run_id !== "string" || run_id.trim() === "") {
      return new Response(JSON.stringify({ error: "run_id required (must be a non-empty string)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const dashboardOutput = (run as any).dashboard_output || {};

    // Build a single comprehensive run object for Expert Forge
    const signals: any[] = [];
    const hypotheses: any[] = [];
    const dataSources: any[] = [];

    // Extract signals from Phase 5
    const phase5 = phaseResults.phase_5 || phaseResults.phase5 || {};
    const rawSignals = phase5.signals || phase5.layers || [];
    if (Array.isArray(rawSignals)) {
      for (const signal of rawSignals) {
        signals.push({
          layer_id: signal.layer_id || signal.layer,
          layer_name: signal.layer_name || signal.layerName || `Capa ${signal.layer_id || signal.layer || "?"}`,
          signal_name: signal.signal_name || signal.name || signal.title || "Sin título",
          confidence: signal.confidence || signal.confidence_score || 0,
          description: signal.description || signal.analysis || "",
          data_source: signal.data_source || signal.sources || "",
          contradicting_evidence: signal.contradicting_evidence || signal.devil_advocate_result || null,
        });
      }
    }

    // Extract hypotheses from Phase 7
    const phase7 = phaseResults.phase_7 || phaseResults.phase7 || {};
    const rawHypotheses = phase7.hypotheses || phase7.actionable_hypotheses || [];
    if (Array.isArray(rawHypotheses)) {
      for (const hyp of rawHypotheses) {
        hypotheses.push({
          title: hyp.title || hyp.hypothesis || "Sin título",
          expected_roi: hyp.expected_roi || hyp.roi || null,
          impact: hyp.impact || hyp.expected_impact || null,
          success_blueprint: hyp.success_blueprint || hyp.action_plan || null,
        });
      }
    }

    // Extract sources from Phase 2
    const phase2 = phaseResults.phase_2 || phaseResults.phase2 || {};
    const rawSources = phase2.sources || phase2.data_sources || [];
    if (Array.isArray(rawSources)) {
      for (const src of rawSources) {
        dataSources.push({
          name: src.name || src.source_name || "Fuente",
          type: src.type || src.source_type || "",
          reliability_score: src.reliability_score || src.reliability || 0,
          url: src.url || "",
        });
      }
    }

    const totalItems = signals.length + hypotheses.length + dataSources.length;
    const dashboardSummary = dashboardOutput.executive_summary || dashboardOutput.summary || null;
    const layersSummary = dashboardOutput.layers_summary || null;

    // Si no hay items extraídos, al menos enviar el resumen del dashboard como fallback
    if (totalItems === 0 && !dashboardSummary && !layersSummary) {
      return new Response(JSON.stringify({ success: false, error: "No patterns to export", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send as a single request with runs array format
    const payload = {
      action: "ingest_patterns",
      project_id: forgeProjectId,
      runs: [{
        run_id,
        sector: (run as any).sector,
        status: run.status,
        model_verdict: run.model_verdict,
        created_at: run.created_at,
        signals,
        hypotheses,
        data_sources: dataSources,
        dashboard_summary: dashboardSummary,
        layers_summary: layersSummary,
      }],
    };

    console.log("Expert Forge payload:", JSON.stringify(payload));
    console.log(`Sending ${totalItems} patterns to Expert Forge (${signals.length} signals, ${hypotheses.length} hypotheses, ${dataSources.length} sources)`);

    const resp = await fetch(forgeGatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": forgeApiKey },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Forge error: ${resp.status} - ${errText}`);
      return new Response(JSON.stringify({
        success: false,
        error: `Expert Forge error (${resp.status}): ${errText}`.substring(0, 500),
        count: 0,
        total: totalItems,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resp.json();
    console.log(`Published ${totalItems} patterns to Expert Forge for run ${run_id}`, result);

    return new Response(JSON.stringify({
      success: true,
      count: totalItems,
      total: totalItems,
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
