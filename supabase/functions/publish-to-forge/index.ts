import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPERT_FORGE_INTERPRETATION_RULES = `EXPERT FORGE — REGLAS DE INTERPRETACIÓN DE PROYECTOS (v2 — 5 Capas A-E)

PRINCIPIO RECTOR
Expert Forge es un EXTRACTOR, no un INVENTOR. Cuando recibe un PRD, su trabajo es identificar y clasificar los componentes que el PRD DEFINE EXPLÍCITAMENTE.

REGLA DE PRECEDENCIA: Si existe un Architecture Manifest JSON en output_data.architecture_manifest, USARLO como source of truth. El Manifest manda sobre el PRD narrativo.

PASO 0: LEER ARCHITECTURE MANIFEST (SI EXISTE)
Si el payload incluye architecture_manifest:
- Usar materialization_target de cada módulo directamente para decidir qué instanciar.
- NO instanciar módulos con phase != "MVP" salvo justificación explícita.
- Respetar los 7 module_type: knowledge_module, action_module, pattern_module, executive_cognition_module, improvement_module, deterministic_engine, router_orchestrator.

REGLA DE PRECEDENCIA ABSOLUTA:
Si architecture_manifest existe en el payload:
- PROHIBIDO re-inferir module_type desde document_text
- PROHIBIDO re-inferir layer desde document_text
- PROHIBIDO re-inferir materialization_target desde document_text
- PROHIBIDO re-inferir phase desde document_text
Solo se permite fallback al PRD narrativo para campos AUSENTES en el manifest.
El manifest es el contrato técnico cerrado. El PRD es documentación explicativa.
- Respetar las 5 capas: A (Knowledge), B (Action), C (Pattern Intelligence), D (Executive Cognition), E (Improvement).
- Mapeo materialization_target → acción:
  * expertforge_rag → Crear RAG
  * expertforge_specialist → Crear Especialista IA
  * expertforge_deterministic_engine → Crear Motor Determinista (sin LLM)
  * expertforge_soul → Configurar Soul
  * expertforge_moe → Crear Router/MoE
  * runtime_only → No instanciar (solo runtime)
  * roadmap_only → No instanciar (roadmap)
  * manual_design → No instanciar (diseño manual)

PASO 0-FALLBACK: SI NO HAY MANIFEST, LEER PRD
Antes de crear NINGÚN componente, lee el PRD completo e identifica:
- INVENTARIO DE COMPONENTES IA (buscar "Inventario", "Componentes IA", "Sección 15", "Capa A-E") → Fuente primaria.
- ALCANCE / SCOPE (buscar "Alcance", "Incluido", "Excluido", "MVP") → NO instancies "Excluido" o "Fase futura".
- MOTORES DETERMINISTAS → NO son especialistas IA. No asignar modelo LLM ni temperatura.
- execution_mode: deterministic = sin LLM; llm_augmented = con LLM; hybrid = ambos.

PASO 1: EXTRAER COMPONENTES (NO INVENTAR)
Para cada componente: Nombre exacto, module_type, layer (A-E), Modelo LLM (solo si aplica), Temperatura, Fase, Edge Function, materialization_target, sensitivity_zone, automation_level.
REGLA CRÍTICA: Si un componente no aparece en el PRD/Manifest, NO LO CREES.

PASO 2: CLASIFICAR (7 TIPOS)
R1 — knowledge_module (Capa A): RAG, embeddings, búsqueda semántica.
R2 — action_module (Capa B): Agente IA con LLM, genera/extrae contenido.
R3 — pattern_module (Capa C): Scoring, ranking, forecasting, anomaly detection. execution_mode determina si usa LLM.
R4 — deterministic_engine (Capa C): Fórmulas, reglas, SQL. NUNCA tiene LLM.
R5 — router_orchestrator (Capa B): Coordina componentes, routing.
R6 — executive_cognition_module (Capa D): Soul. Solo si enabled=true con governance_rules.
R7 — improvement_module (Capa E): Telemetría, feedback loops, evaluación.

PASO 3: ASIGNAR TEMPERATURA (SI NO ESPECIFICADA)
Extracción: 0.1-0.2 | Clasificación: 0.2-0.3 | Análisis: 0.3-0.5 | Generación: 0.5-0.7 | Creatividad: 0.7-0.9
NUNCA misma temperatura para todos.

PASO 4: VINCULAR RAGs (SOLO SI EXISTEN)
Motor determinista NUNCA tiene RAG vinculado. Si PRD no define RAGs: NO crear.

PASO 5: VALIDACIONES POST-INSTANCIACIÓN
V01 — COMPONENTE FANTASMA: No en PRD/Manifest → ELIMINAR.
V02 — COMPONENTE FALTANTE: En PRD/Manifest pero no instanciado → AÑADIR.
V03 — MOTOR CON LLM: Motor determinista con LLM → ELIMINAR modelo.
V04 — TEMPERATURA UNIFORME: Todos misma temp → CORREGIR.
V05 — RAG FANTASMA: RAG no definido → ELIMINAR.
V06 — ALCANCE: Componente "Excluido"/"Fase futura" instanciado → ELIMINAR.
V07 — PHASE/MATERIALIZATION: phase != MVP con materialization_target activo → VERIFICAR justificación.
V08 — SOUL SIN GOVERNANCE: Soul enabled sin governance_rules → NO instanciar.

ANTIPATRONES PROHIBIDOS
- NO inventes componentes no descritos en PRD/Manifest.
- NO asignes LLM a motores deterministas (execution_mode=deterministic).
- NO instancies módulos con materialization_target=roadmap_only o manual_design.
- NO instancies Soul sin governance_rules.

ÚLTIMA REGLA: Si tienes duda sobre si un componente debe existir, la respuesta es NO.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      action: requestAction,
      project_id,
      document_text,
      project_name,
      project_description,
      architecture_manifest,
      build_mode, source_of_truth, mode, rewrite,
      inference_layer, extraction_metadata, architecture_alternatives,
      scope, full_prd, future_phases, duplicate_naming,
      alternate_roles, alternate_states, undefined_tables_or_queries,
    } = body;

    const EXPERT_FORGE_API_KEY = Deno.env.get("EXPERT_FORGE_API_KEY");
    if (!EXPERT_FORGE_API_KEY) {
      return new Response(JSON.stringify({ error: "Expert Forge no está configurado. Añade EXPERT_FORGE_API_KEY." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GATEWAY_URL = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";

    const callGateway = async (payload: Record<string, unknown>) => {
      console.log(`[publish-to-forge] Calling gateway action=${payload.action}`);
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "x-api-key": EXPERT_FORGE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      console.log(`[publish-to-forge] Gateway response status=${res.status} for action=${payload.action}`);
      return res;
    };

    // ── verify: proxy list_rags + list_specialists ──
    if (requestAction === "verify") {
      if (!project_id) {
        return new Response(JSON.stringify({ error: "project_id requerido para verify" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[publish-to-forge] Mode: verify — fetching rags + specialists");

      const [ragsRes, specialistsRes] = await Promise.all([
        callGateway({ action: "list_rags", project_id }),
        callGateway({ action: "list_specialists", project_id }),
      ]);

      const rags = ragsRes.ok ? await ragsRes.json() : { error: await ragsRes.text() };
      const specialists = specialistsRes.ok ? await specialistsRes.json() : { error: await specialistsRes.text() };

      return new Response(JSON.stringify({
        success: true,
        rags: rags.rags || rags.data || rags,
        specialists: specialists.specialists || specialists.data || specialists,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For architect actions, document_text and project_name are required
    console.log(`[publish-to-forge] action=${requestAction}, project_name=${project_name}, document_text length=${document_text?.length || 0} chars`);
    if (document_text) {
      console.log(`[publish-to-forge] document_text first 200 chars: ${document_text.slice(0, 200)}`);
    }
    if (!document_text || document_text.length < 100) {
      return new Response(JSON.stringify({ 
        error: `document_text vacío o muy corto (${document_text?.length || 0} chars). El PRD debe tener al menos 100 caracteres.` 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!project_name) {
      return new Response(JSON.stringify({ error: "Se requiere project_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contractFields = {
      build_mode: build_mode || "STRICT",
      source_of_truth: source_of_truth || "BUILD_SLICE_F0_F1",
      mode: mode || "LITERAL",
      rewrite: rewrite || "FORBIDDEN",
      inference_layer: inference_layer || "DISABLED",
      extraction_metadata: extraction_metadata || "EXCLUDED",
      architecture_alternatives: architecture_alternatives || "EXCLUDED",
      scope: scope || "ONLY_BUILD_SLICE_F0_F1",
      full_prd: full_prd || "EXCLUDED",
      future_phases: future_phases || "EXCLUDED",
      duplicate_naming: duplicate_naming || "FORBIDDEN",
      alternate_roles: alternate_roles || "FORBIDDEN",
      alternate_states: alternate_states || "FORBIDDEN",
      undefined_tables_or_queries: undefined_tables_or_queries || "FORBIDDEN",
      interpretation_rules: EXPERT_FORGE_INTERPRETATION_RULES,
    };

    // ── create_and_architect: single architect call with auto_provision ──
    if (requestAction === "create_and_architect") {
      console.log("[publish-to-forge] Mode: create_and_architect (single architect call with auto_provision)");

      // Pre-cleanup: wipe stale components so deduplication doesn't reuse garbage
      if (project_id) {
        console.log("[publish-to-forge] Pre-cleanup: removing stale components for project", project_id);
        try {
          const cleanRes = await callGateway({
            action: "clean_project",
            project_id,
            user_id: userId,
          });
          console.log(`[publish-to-forge] clean_project status=${cleanRes.status}`);
          if (!cleanRes.ok) {
            const cleanErr = await cleanRes.text();
            console.warn("[publish-to-forge] clean_project failed (continuing anyway):", cleanErr.slice(0, 300));
          } else {
            const cleanResult = await cleanRes.json();
            console.log("[publish-to-forge] clean_project result:", JSON.stringify(cleanResult).slice(0, 500));
          }
        } catch (cleanError) {
          console.warn("[publish-to-forge] clean_project threw (continuing anyway):", cleanError);
        }
      }

      const payload: Record<string, unknown> = {
        action: "architect",
        user_id: userId,
        project_id: project_id || undefined,
        project_name,
        project_description: project_description || "",
        document_text: document_text.slice(0, 500000),
        auto_provision: true,
        force_new: true, // Skip deduplication — create fresh from PRD
        ...contractFields,
      };
      if (architecture_manifest) {
        payload.architecture_manifest = architecture_manifest;
        console.log("[publish-to-forge] Including architecture_manifest in architect payload");
      }

      console.log(`[publish-to-forge] Sending architect payload: project_id=${project_id}, doc_length=${payload.document_text.length}, force_new=true`);

      const res = await callGateway(payload);
      if (!res.ok) {
        const errText = await res.text();
        console.error("[publish-to-forge] create_and_architect failed:", res.status, errText);
        return new Response(JSON.stringify({
          error: `Expert Forge architect falló (${res.status})`,
          details: errText.slice(0, 500),
        }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await res.json();
      console.log("[publish-to-forge] create_and_architect completed successfully");
      console.log("[publish-to-forge] architect result:", JSON.stringify(result).slice(0, 1000));

      return new Response(JSON.stringify({
        success: true,
        phase: "create_and_architect",
        result,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default: architect only ──
    const basePayload: Record<string, unknown> = {
      action: "architect",
      user_id: userId,
      project_name,
      project_description: project_description || "",
      document_text: document_text.slice(0, 500000),
      auto_provision: true,
      force_new: true,
      ...contractFields,
    };
    if (architecture_manifest) {
      basePayload.architecture_manifest = architecture_manifest;
    }

    let forgeResponse = await callGateway({ ...basePayload, project_id });

    if (!forgeResponse.ok) {
      let errText = await forgeResponse.text();
      const missingProject = forgeResponse.status === 404 && /project not found/i.test(errText);

      if (missingProject) {
        console.warn("[publish-to-forge] Project not found in Expert Forge, retrying without project_id");
        forgeResponse = await callGateway(basePayload);
        if (!forgeResponse.ok) {
          errText = await forgeResponse.text();
        }
      }

      if (!forgeResponse.ok) {
        console.error("[publish-to-forge] Expert Forge error:", forgeResponse.status, errText);
        return new Response(JSON.stringify({
          error: `Expert Forge respondió con error ${forgeResponse.status}`,
          details: errText.slice(0, 500),
        }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = await forgeResponse.json();
    console.log("[publish-to-forge] default architect result:", JSON.stringify(result).slice(0, 1000));

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[publish-to-forge] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
