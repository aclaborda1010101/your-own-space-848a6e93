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
      forge_architecture,
      audited_components,
      automation_roadmap,
      stack_ia,
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

    // ── Build structured forge payload from manifest/audit data ──
    const buildForgeStructuredPayload = (opts: {
      manifest?: any; forgeArch?: any; auditedComps?: any[];
      auditRoadmap?: any; stackIa?: any;
    }) => {
      const { manifest, forgeArch, auditedComps, auditRoadmap, stackIa } = opts;
      const modules = forgeArch?.modules || manifest?.modules || [];

      // Group by layer
      const components_by_layer: Record<string, any[]> = { A: [], B: [], C: [], D: [], E: [] };
      for (const m of modules) {
        const layer = m.capa || m.layer || "B";
        if (!components_by_layer[layer]) components_by_layer[layer] = [];
        // Find matching audit data for enrichment
        const auditMatch = auditedComps?.find((ac: any) =>
          ac.id === (m.forge_id || m.module_id) || ac.nombre === (m.nombre_tecnico || m.module_name)
        );
        components_by_layer[layer].push({
          id: m.forge_id || m.module_id,
          name: m.nombre_tecnico || m.module_name,
          module_type: m.module_type,
          description: m.descripcion_tecnica || m.purpose || "",
          business_problem: m.business_problem || m.business_problem_solved || "",
          inputs: m.inputs || [],
          outputs: m.outputs || [],
          dependencies: m.dependencias || m.dependencies || [],
          phase: m.phase || "MVP",
          execution_mode: m.tech_stack?.execution_mode || m.execution_mode || "llm_augmented",
          materialization_target: m.tech_stack?.materialization_target || m.materialization_target || "runtime_only",
          governance: m.governance || {
            sensitivity_zone: m.sensitivity_zone || "business",
            automation_level: m.automation_level || "semi_automatic",
            requires_human_approval: m.requires_human_approval || false,
          },
          // Enriched from audit
          recommended_ai_approach: auditMatch?.recommended_ai_approach || null,
          automation_potential: auditMatch?.automation_potential || null,
        });
      }

      // Extract RAGs needed (layer A = knowledge_modules) — project-specific
      const projectRags = components_by_layer.A.map((m: any) => {
        // Pull rich metadata from forge_architecture source module
        const srcModule = (forgeArch?.modules || []).find((fm: any) =>
          (fm.forge_id || fm.module_id) === m.id || (fm.nombre_tecnico || fm.module_name) === m.name
        );
        const auditMatch = auditedComps?.find((ac: any) =>
          ac.id === m.id || ac.nombre === m.name
        );
        return {
          id: m.id,
          name: m.name,
          type: "internal" as const,
          scope: srcModule?.scope || srcModule?.descripcion_tecnica || m.description,
          document_categories: srcModule?.document_categories || srcModule?.source_systems || m.inputs || [],
          sources: srcModule?.source_systems || m.inputs || [],
          indexing_strategy: srcModule?.indexing_strategy || srcModule?.tech_stack?.indexing_strategy || "semantic_chunked",
          embedding_model: srcModule?.embedding_model || stackIa?.embedding || "text-embedding-3-small",
          chunk_config: srcModule?.chunk_config || { size: 512, overlap: 64 },
          retrieval_strategy: srcModule?.retrieval_strategy || "hybrid_semantic_keyword",
          sensitivity_zone: m.governance?.sensitivity_zone || "business",
          phase: m.phase,
          materialization_target: m.materialization_target,
          automation_potential: auditMatch?.automation_potential || null,
        };
      });

      // ── Inject EXTERNAL RAGs (market data, public registries, industry benchmarks) ──
      // These provide context the project needs but doesn't generate internally
      const sectorHint = (forgeArch?.project_summary?.sector || manifest?.project_summary?.sector || "").toLowerCase();
      const geoHint = (forgeArch?.project_summary?.geography || manifest?.project_summary?.geography || "España").toLowerCase();
      const isSpain = geoHint.includes("españa") || geoHint.includes("spain") || geoHint.includes("es");

      const EXTERNAL_RAG_CATALOG: Array<{
        id: string; name: string; scope: string;
        document_categories: string[]; sources: string[];
        condition?: (sector: string, geo: string) => boolean;
      }> = [
        {
          id: "EXT-RAG-INE",
          name: "RAG Datos INE (Instituto Nacional de Estadística)",
          scope: "Datos demográficos, económicos, laborales y sectoriales de España. Series temporales, indicadores macro y microdatos.",
          document_categories: ["demografía", "economía", "empleo", "sectores productivos"],
          sources: ["ine.es", "API INE JSON"],
          condition: (_s, g) => g.includes("españa") || g.includes("spain") || g.includes("es"),
        },
        {
          id: "EXT-RAG-CATASTRO",
          name: "RAG Catastro y Datos Inmobiliarios",
          scope: "Datos catastrales, valoraciones, superficies, usos del suelo, referencias catastrales. Útil para proyectos con componente geoespacial o inmobiliario.",
          document_categories: ["catastro", "inmobiliario", "geoespacial", "valoraciones"],
          sources: ["catastro.meh.es", "Idealista API", "registradores.org"],
          condition: (s) => ["inmobiliario", "real_estate", "retail", "centros_comerciales", "logística", "urbanismo"].some(k => s.includes(k)),
        },
        {
          id: "EXT-RAG-MARKET-DATA",
          name: "RAG Datos de Mercado y Competencia",
          scope: "Informes sectoriales, cuotas de mercado, tendencias de consumo, benchmarks competitivos, pricing de competidores.",
          document_categories: ["informes sectoriales", "competencia", "tendencias", "pricing"],
          sources: ["Statista", "Euromonitor", "informes sectoriales públicos"],
        },
        {
          id: "EXT-RAG-LEGAL-REGULATORY",
          name: "RAG Normativa y Regulación Sectorial",
          scope: "Marco legal aplicable, regulaciones sectoriales, GDPR/LOPD, normativas técnicas, compliance requirements.",
          document_categories: ["legislación", "regulación", "compliance", "normativa técnica"],
          sources: ["BOE", "EUR-Lex", "AEPD", "normativa sectorial"],
        },
        {
          id: "EXT-RAG-FINANCIAL-BENCHMARKS",
          name: "RAG Benchmarks Financieros y KPIs Sectoriales",
          scope: "Ratios financieros por sector, márgenes promedio, costes de adquisición, LTV, CAC, unit economics de referencia.",
          document_categories: ["ratios financieros", "unit economics", "KPIs sectoriales", "márgenes"],
          sources: ["Banco de España", "informes anuales sectoriales", "SABI/Informa"],
        },
        {
          id: "EXT-RAG-TECH-STACK",
          name: "RAG Documentación Técnica y APIs",
          scope: "Documentación de APIs, SDKs, frameworks y servicios cloud relevantes para la implementación del proyecto.",
          document_categories: ["documentación API", "SDK", "frameworks", "cloud services"],
          sources: ["docs oficiales", "GitHub", "Stack Overflow"],
        },
        {
          id: "EXT-RAG-GEO-MOBILITY",
          name: "RAG Datos Geoespaciales y Movilidad",
          scope: "Flujos de movilidad, datos de tráfico peatonal/vehicular, zonas de influencia, isócronas, puntos de interés.",
          document_categories: ["movilidad", "tráfico", "geoespacial", "POIs"],
          sources: ["Google Places API", "datos municipales", "operadores telecom"],
          condition: (s) => ["retail", "centros_comerciales", "logística", "hostelería", "turismo", "inmobiliario"].some(k => s.includes(k)),
        },
        {
          id: "EXT-RAG-CONSUMER-BEHAVIOR",
          name: "RAG Comportamiento del Consumidor",
          scope: "Patrones de compra, segmentación de clientes, NPS benchmarks, journey maps de referencia, tendencias de consumo digital.",
          document_categories: ["comportamiento consumidor", "segmentación", "customer journey", "NPS"],
          sources: ["Google Trends", "estudios de consumo", "encuestas sectoriales"],
          condition: (s) => ["retail", "ecommerce", "saas", "b2c", "hostelería", "centros_comerciales"].some(k => s.includes(k)),
        },
        {
          id: "EXT-RAG-HR-TALENT",
          name: "RAG Mercado Laboral y Talento",
          scope: "Salarios de referencia, perfiles más demandados, rotación sectorial, tendencias de contratación.",
          document_categories: ["salarios", "talento", "contratación", "rotación"],
          sources: ["InfoJobs", "LinkedIn Talent Insights", "Hays/Randstad reports"],
          condition: (s) => ["rrhh", "hr", "talent", "recruitment", "consulting"].some(k => s.includes(k)),
        },
        {
          id: "EXT-RAG-SUPPLY-CHAIN",
          name: "RAG Cadena de Suministro y Logística",
          scope: "Costes logísticos, tiempos de entrega, proveedores, tendencias supply chain, riesgos de abastecimiento.",
          document_categories: ["logística", "supply chain", "proveedores", "inventario"],
          sources: ["datos logísticos", "informes supply chain"],
          condition: (s) => ["logística", "manufacturing", "retail", "ecommerce", "distribución", "supply"].some(k => s.includes(k)),
        },
      ];

      // Select applicable external RAGs (always include first 6 universal ones, conditionals by sector/geo)
      const externalRags = EXTERNAL_RAG_CATALOG
        .filter(r => !r.condition || r.condition(sectorHint, geoHint))
        .map(r => ({
          id: r.id,
          name: r.name,
          type: "external" as const,
          scope: r.scope,
          document_categories: r.document_categories,
          sources: r.sources,
          indexing_strategy: "semantic_chunked",
          embedding_model: stackIa?.embedding || "text-embedding-3-small",
          chunk_config: { size: 512, overlap: 64 },
          retrieval_strategy: "hybrid_semantic_keyword",
          sensitivity_zone: "public",
          phase: "MVP",
          materialization_target: "expertforge_rag",
          automation_potential: null,
        }));

      // Ensure minimum 8 RAGs total
      const rags_needed = [...projectRags, ...externalRags];
      console.log(`[publish-to-forge] RAGs: ${projectRags.length} internal + ${externalRags.length} external = ${rags_needed.length} total`);

      // Extract specialists needed (layer B action_modules) — with full system_prompts
      const specialists_needed = components_by_layer.B
        .filter((m: any) => m.module_type === "action_module")
        .map((m: any) => {
          const srcModule = (forgeArch?.modules || []).find((fm: any) =>
            (fm.forge_id || fm.module_id) === m.id || (fm.nombre_tecnico || fm.module_name) === m.name
          );
          const auditMatch = auditedComps?.find((ac: any) =>
            ac.id === m.id || ac.nombre === m.name
          );
          const aiApproach = auditMatch?.recommended_ai_approach || m.recommended_ai_approach || {};
          const stackMatch = stackIa?.modelo_por_componente?.find(
            (s: any) => s.componente_id === m.id || s.componente_nombre === m.name
          );

          // Build project-specific system prompt from all available context
          const ragDeps = (m.dependencies || []).filter((d: string) => d.startsWith("KB-") || d.startsWith("RAG-"));
          const ragContext = ragDeps.length > 0
            ? `\nTienes acceso a las siguientes bases de conocimiento: ${ragDeps.join(", ")}. Úsalas para fundamentar cada respuesta con datos reales del proyecto.`
            : "";
          const outputSpec = (m.outputs || []).length > 0
            ? `\nTu output debe incluir: ${(m.outputs || []).join(", ")}.`
            : "";
          const constraintSpec = srcModule?.constraints
            ? `\nRestricciones: ${Array.isArray(srcModule.constraints) ? srcModule.constraints.join("; ") : srcModule.constraints}`
            : "";

          const system_prompt = srcModule?.system_prompt
            || `Eres "${m.name}", un especialista IA dentro del sistema "${body.project_name || project_name}".

FUNCIÓN PRINCIPAL: ${srcModule?.descripcion_tecnica || m.description}

PROBLEMA DE NEGOCIO QUE RESUELVES: ${m.business_problem || "No especificado"}

INPUTS QUE RECIBES: ${(m.inputs || []).join(", ") || "Según contexto"}
${outputSpec}${ragContext}${constraintSpec}

REGLAS:
- Responde SOLO dentro de tu dominio de competencia.
- Si no tienes información suficiente, indica explícitamente qué falta.
- Sensibilidad: ${m.governance?.sensitivity_zone || "business"}.${m.governance?.requires_human_approval ? "\n- REQUIERE aprobación humana antes de ejecutar acciones." : ""}`;

          return {
            id: m.id,
            name: m.name,
            role: srcModule?.descripcion_tecnica || m.description,
            business_problem: m.business_problem,
            model: stackMatch?.modelo_recomendado || aiApproach.modelo_principal || srcModule?.tech_stack?.modelo || "gemini-2.5-flash",
            temperature: stackMatch?.temperatura ?? srcModule?.tech_stack?.temperatura ?? 0.3,
            system_prompt,
            rag_links: ragDeps,
            inputs: m.inputs,
            outputs: m.outputs,
            phase: m.phase,
            sensitivity_zone: m.governance?.sensitivity_zone || "business",
            requires_human_approval: m.governance?.requires_human_approval || false,
            execution_mode: m.execution_mode,
            automation_potential: auditMatch?.automation_potential || null,
          };
        });

      // Extract MoE config (router_orchestrators)
      const routers = components_by_layer.B.filter((m: any) => m.module_type === "router_orchestrator");
      const moe_config = routers.length > 0 ? {
        enabled: true,
        routers: routers.map((r: any) => ({
          id: r.id,
          name: r.name,
          routes_to: r.dependencies,
          strategy: r.execution_mode === "deterministic" ? "rule_based" : "llm_routing",
        })),
      } : { enabled: false };

      // Pattern modules + deterministic engines (layer C)
      const engines_and_patterns = components_by_layer.C.map((m: any) => ({
        id: m.id,
        name: m.name,
        module_type: m.module_type,
        execution_mode: m.execution_mode,
        description: m.description,
        inputs: m.inputs,
        outputs: m.outputs,
        phase: m.phase,
      }));

      return {
        components_by_layer,
        rags_needed,
        specialists_needed,
        moe_config,
        engines_and_patterns,
        automation_roadmap: auditRoadmap || null,
        stack_ia_summary: stackIa ? {
          llm_principal: stackIa.llm_principal,
          llm_ligero: stackIa.llm_ligero,
          embedding: stackIa.embedding,
          vector_db: stackIa.vector_db,
          rag_strategy: stackIa.estrategia_rag || null,
          coste_mensual: stackIa.coste_mensual_estimado || null,
        } : null,
        total_modules: modules.length,
        modules_mvp: modules.filter((m: any) => (m.phase || "").toUpperCase() === "MVP").length,
      };
    };

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

      // Build structured payload for Expert Forge
      const structured = buildForgeStructuredPayload({
        manifest: architecture_manifest,
        forgeArch: forge_architecture,
        auditedComps: audited_components,
        auditRoadmap: automation_roadmap,
        stackIa: stack_ia,
      });

      console.log(`[publish-to-forge] Structured payload: ${structured.total_modules} modules, ${structured.rags_needed.length} RAGs, ${structured.specialists_needed.length} specialists, moe=${structured.moe_config.enabled}`);

      const payload: Record<string, unknown> = {
        action: "architect",
        user_id: userId,
        project_id: project_id || undefined,
        project_name,
        project_description: project_description || "",
        // Canonical fields for Expert Forge Gateway
        prd_text: document_text.slice(0, 500000),
        manifest: architecture_manifest || undefined,
        forge_architecture: forge_architecture || undefined,
        audited_components: audited_components || undefined,
        rags_needed: structured.rags_needed,
        specialists_needed: structured.specialists_needed,
        moe_config: structured.moe_config,
        // Supplementary structured data
        components_by_layer: structured.components_by_layer,
        engines_and_patterns: structured.engines_and_patterns,
        automation_roadmap: structured.automation_roadmap,
        stack_ia_summary: structured.stack_ia_summary,
        auto_provision: true,
        force_new: true,
        ...contractFields,
      };

      console.log(`[publish-to-forge] Sending architect payload: project_id=${project_id}, prd_length=${(payload.prd_text as string).length}, manifest=${!!payload.manifest}, audited=${!!payload.audited_components}, rags=${structured.rags_needed.length}, specialists=${structured.specialists_needed.length}`);

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
    const defaultStructured = buildForgeStructuredPayload({
      manifest: architecture_manifest,
      forgeArch: forge_architecture,
      auditedComps: audited_components,
      auditRoadmap: automation_roadmap,
      stackIa: stack_ia,
    });

    const basePayload: Record<string, unknown> = {
      action: "architect",
      user_id: userId,
      project_name,
      project_description: project_description || "",
      prd_text: document_text.slice(0, 500000),
      manifest: architecture_manifest || undefined,
      forge_architecture: forge_architecture || undefined,
      audited_components: audited_components || undefined,
      rags_needed: defaultStructured.rags_needed,
      specialists_needed: defaultStructured.specialists_needed,
      moe_config: defaultStructured.moe_config,
      components_by_layer: defaultStructured.components_by_layer,
      engines_and_patterns: defaultStructured.engines_and_patterns,
      automation_roadmap: defaultStructured.automation_roadmap,
      stack_ia_summary: defaultStructured.stack_ia_summary,
      auto_provision: true,
      force_new: true,
      ...contractFields,
    };

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
