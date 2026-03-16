import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPERT_FORGE_INTERPRETATION_RULES = `EXPERT FORGE — REGLAS DE INTERPRETACIÓN DE PROYECTOS

PRINCIPIO RECTOR
Expert Forge es un EXTRACTOR, no un INVENTOR. Cuando recibe un PRD, su trabajo es identificar y clasificar los componentes que el PRD DEFINE EXPLÍCITAMENTE, no imaginar componentes que "podrían ser útiles".
Si el PRD no menciona un componente, ese componente NO EXISTE. Si el PRD menciona algo tangencialmente, NO se convierte en componente principal. Si el PRD dice "Fase futura" o "Excluido del MVP", NO se instancia ahora.

PASO 0: LECTURA OBLIGATORIA ANTES DE INSTANCIAR
Antes de crear NINGÚN RAG, especialista, motor o módulo, lee el PRD completo e identifica:
- INVENTARIO DE COMPONENTES IA (buscar "Inventario", "Componentes IA", "Diseño de IA") → Fuente primaria. Instanciar estos. Ni más, ni menos.
- ALCANCE / SCOPE (buscar "Alcance", "Incluido", "Excluido", "MVP") → NO instancies componentes "Excluido" o "Fase futura".
- MOTORES DETERMINISTAS (buscar "Determinista", "Scoring", "Motor de reglas", "Fórmulas") → NO son especialistas IA. No asignar modelo LLM ni temperatura.
- EDGE FUNCTIONS (buscar "Edge Functions", "Funciones serverless") → Cada Edge Function que llama a un LLM = especialista. Cada Edge Function que ejecuta SQL/cálculos = motor determinista.
- RAGs / BASES DE CONOCIMIENTO (buscar "RAG", "Base de conocimiento", "Embeddings", "pgvector") → Si el PRD define RAGs, instanciarlos. Si dice "0 RAGs en MVP", NO crear RAGs.

PASO 1: EXTRAER COMPONENTES DEL PRD (NO INVENTAR)
Para cada componente encontrado en el PRD, extraer: Nombre exacto, Tipo (especialista IA / motor determinista / orquestador / RAG), Modelo LLM (solo si el PRD lo especifica), Temperatura (solo si el PRD la especifica), Fase, Edge Function asociada.
REGLA CRÍTICA: Si un componente no aparece en el PRD, NO LO CREES.

PASO 2: CLASIFICAR (REGLAS DE TIPO)
R1 — MOTOR DETERMINISTA: Ejecuta fórmulas matemáticas, reglas binarias, funciones SQL, output reproducible → NO tiene modelo LLM, NO tiene temperatura, NO necesita RAG.
R2 — ORQUESTADOR: Coordina otros componentes, gestiona fases o transiciones → Puede o no tener modelo LLM (según PRD).
R3 — RAG: Repositorio de documentos indexados, usa embeddings/búsqueda semántica → NO es un especialista.
R4 — ESPECIALISTA IA: Llama a un LLM, extrae datos no estructurados, genera contenido → DEBE tener modelo LLM y temperatura.

PASO 3: ASIGNAR TEMPERATURA (SI EL PRD NO LA ESPECIFICA)
Extracción de datos (OCR, parsing): 0.1-0.2 | Clasificación: 0.2-0.3 | Auditoría: 0.2-0.3 | Análisis: 0.3-0.5 | Matching/scoring soft: 0.4-0.5 | Generación de contenido: 0.5-0.7 | Creatividad/brainstorming: 0.7-0.9
NUNCA asignes la misma temperatura a todos los especialistas.

PASO 4: VINCULAR RAGs (SOLO SI EXISTEN)
Si el PRD define RAGs: crear con fuentes explícitas y vincular. Motor determinista NUNCA tiene RAG vinculado. Si PRD no define RAGs: NO crear RAGs. Marcar "RAGs: ninguno en esta fase".

PASO 5: VALIDACIONES POST-INSTANCIACIÓN
V01 — COMPONENTE FANTASMA: ¿Componente creado que NO aparece en PRD? → ELIMINAR.
V02 — COMPONENTE FALTANTE: ¿Componente del PRD no instanciado? → AÑADIR.
V03 — MOTOR CON LLM: ¿Motor determinista con modelo LLM? → ELIMINAR modelo y temperatura.
V04 — TEMPERATURA UNIFORME: ¿Todos los especialistas misma temperatura? → CORREGIR.
V05 — RAG FANTASMA: ¿RAG creado que PRD no define? → ELIMINAR.
V06 — ALCANCE CORRECTO: ¿Componente "Excluido"/"Fase futura" instanciado? → ELIMINAR.
V07 — COHERENCIA DE SECTOR: ¿Componentes coherentes con el sector del PRD? → VERIFICAR.
V08 — TRAZABILIDAD: ¿Cada componente apunta a sección específica del PRD? → VERIFICAR.

ANTIPATRONES PROHIBIDOS
- NO inventes componentes que "serían útiles" pero no están en el PRD.
- NO conviertas menciones tangenciales en componentes principales.
- NO asignes LLM a motores deterministas.
- NO crees RAGs si el PRD dice "0 RAGs en MVP".
- NO asignes la misma temperatura a todos los especialistas.
- NO instancies componentes marcados como "Excluido" o "Fase futura".
- NO interpretes el sector del proyecto — extráelo del PRD.
- NO presentes componentes sin citar la sección del PRD que los origina.

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

    const {
      project_id,
      document_text,
      project_name,
      project_description,
      // ── Strict build-slice fields ──
      build_mode,
      source_of_truth,
      mode,
      rewrite,
      inference_layer,
      extraction_metadata,
      architecture_alternatives,
      scope,
      full_prd,
      future_phases,
      duplicate_naming,
      alternate_roles,
      alternate_states,
      undefined_tables_or_queries,
    } = await req.json();

    if (!document_text || !project_name) {
      return new Response(JSON.stringify({ error: "Se requiere document_text y project_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EXPERT_FORGE_API_KEY = Deno.env.get("EXPERT_FORGE_API_KEY");

    if (!EXPERT_FORGE_API_KEY) {
      return new Response(JSON.stringify({ error: "Expert Forge no está configurado. Añade EXPERT_FORGE_API_KEY." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GATEWAY_URL = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";

    const callGateway = async (payload: Record<string, unknown>) => {
      return await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "x-api-key": EXPERT_FORGE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    const basePayload = {
      action: "architect",
      user_id: userId,
      project_name,
      project_description: project_description || "",
      document_text: document_text.slice(0, 500000),
      auto_provision: true,
      // ── Strict build-slice contract — enforced server-side ──
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
