// ═══════════════════════════════════════════════════════════════════════════════
// REEMPLAZO PARA: supabase/functions/project-wizard-step/index.ts
// SECCIÓN: action === "generate_prd" (líneas ~489-580 del archivo original)
// ═══════════════════════════════════════════════════════════════════════════════
//
// INSTRUCCIONES PARA LOVABLE:
// 1. En project-wizard-step/index.ts, eliminar todo el bloque:
//      if (action === "generate_prd") { ... }
//    (líneas 489-580 aprox)
// 2. Reemplazarlo con el código de abajo.
// 3. Actualizar STEP_MODELS en projectPipelinePrompts.ts (step 7: "gemini-pro")
// 4. No tocar el resto de acciones (extract, generate_scope, run_audit, etc.)
//
// CAMBIOS:
// - 4 calls generativas secuenciales (era 2) con Gemini Pro 2.5
// - 1 call de validación cruzada con Claude Sonnet (auditor)
// - max_tokens: 8192 por call generativa (era 16384 en 2 calls)
// - Output: Markdown plano (ya era Markdown, ahora con estructura Lovable-ready)
// - Nuevo: Blueprint Lovable separado como sección copy/paste
// - Nuevo: Specs D1 (RAG) y D2 (Patrones) como metadata
// - Nuevo: Validation report con inconsistencias detectadas
// - Modelo: Gemini Pro 2.5 principal, Claude Sonnet fallback
// - Coste: ~60-70% menor que 4 calls con Claude Sonnet
// ═══════════════════════════════════════════════════════════════════════════════

    // ── Action: generate_prd (Step 7) — 4 generative calls + 1 validation ──
    if (action === "generate_prd") {
      const sd = stepData;
      const finalStr = truncate(typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2));
      const aiLevStr = truncate(typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2));
      const briefStr = truncate(typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2));
      const targetPhase = sd.targetPhase || "Fase 0 + Fase 1 (MVP)";

      // ── System prompt (shared across all 4 generative calls) ──
      const prdSystemPrompt = `Eres un Product Manager técnico senior especializado en generar PRDs que se convierten directamente en aplicaciones funcionales via Lovable (plataforma de generación de código con IA).

## STACK OBLIGATORIO
Todo lo que generes DEBE usar exclusivamente este stack:
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth, PostgreSQL, Storage, Edge Functions con Deno, Realtime)
- Routing: react-router-dom
- Iconos: lucide-react
- Charts: recharts (si aplica)
- Estado: React hooks (useState, useEffect, useContext) — NO Redux, NO Zustand
- Pagos: Stripe via Supabase Edge Function (si aplica)

PROHIBIDO mencionar: Next.js, Express, NestJS, microservicios, JWT custom, AWS, Azure, Docker, Kubernetes, MongoDB, Firebase.
Si el documento de alcance o la auditoría IA mencionan estas tecnologías, TRADÚCELAS al stack Lovable equivalente.

## REGLAS DE ESCRITURA
1. FORMATO: Markdown plano con tablas Markdown, bloques de código y listas. NUNCA JSON anidado.
2. MEDIBLE: Cada requisito debe ser testeable. "El sistema debe ser rápido" → "Tiempo de carga <2s en 3G".
3. TRAZABLE: Cada módulo mapea a pantallas + entidades + endpoints concretos.
4. IA CON GUARDRAILS: Toda funcionalidad de IA DEBE tener: fallback si falla, logging en tabla auditoria_ia, coste por operación, y precisión esperada.
5. NÚMEROS HONESTOS: Si un ROI o métrica es hipotético (sin datos reales), márcalo como "[HIPÓTESIS — requiere validación con datos reales]".
6. LOVABLE-ESPECÍFICO: Los modelos de datos deben ser CREATE TABLE SQL ejecutable en Supabase. Las políticas de RLS deben estar incluidas. Los componentes IA deben ser Edge Functions con triggers.
7. POR FASE: Marca cada pantalla, tabla, componente y función con la fase en la que se introduce (Fase 0, 1, 2...).
8. IDIOMA: español (España).

## REGLAS DE NOMBRES PROPIOS
Verifica que los nombres de empresas, stakeholders y productos estén escritos correctamente según el briefing original. Si detectas variaciones, usa la forma correcta.`;

      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let mainModelUsed = "gemini-2.5-pro";
      let prdFallbackUsed = false;

      // Helper: call Gemini Pro with fallback to Claude Sonnet
      const callPrdModel = async (system: string, user: string): Promise<{ text: string; tokensInput: number; tokensOutput: number }> => {
        try {
          return await callGeminiPro(system, user);
        } catch (geminiError) {
          console.warn("[PRD] Gemini Pro failed, falling back to Claude Sonnet:", geminiError instanceof Error ? geminiError.message : geminiError);
          prdFallbackUsed = true;
          mainModelUsed = "claude-sonnet-4";
          return await callClaudeSonnet(system, user);
        }
      };

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 1: Sections 1-5 (Resumen, Objetivos, Alcance, Personas, Flujos)
      // ═══════════════════════════════════════════════════════════════════════
      const userPrompt1 = `CONTEXTO DEL PROYECTO:

DOCUMENTO FINAL APROBADO:
${finalStr}

AI LEVERAGE (oportunidades IA):
${aiLevStr}

BRIEFING ORIGINAL:
${briefStr}

FASE OBJETIVO: ${targetPhase}

GENERA LAS SECCIONES 1 A 5 DEL PRD EN MARKDOWN:

# 1. RESUMEN EJECUTIVO
Un párrafo denso: empresa, problema cuantificado, solución, stack (React+Vite+Supabase), resultado esperado.
Incluir: "Este PRD es Lovable-ready: cada sección se traduce directamente en código ejecutable."

# 2. OBJETIVOS Y MÉTRICAS
| ID | Objetivo | Prioridad | Métrica de éxito | Baseline | Target 6m | Fase |
Incluir objetivos P0, P1 y P2 con métricas cuantificadas. Marcar hipótesis con [HIPÓTESIS].

# 3. ALCANCE V1 CERRADO
## 3.1 Incluido
| Módulo | Funcionalidad | Prioridad | Fase | Pantalla(s) | Entidad(es) |
## 3.2 Excluido
| Funcionalidad | Motivo exclusión | Fase futura |
## 3.3 Supuestos
Lista numerada de supuestos con impacto si fallan.

# 4. PERSONAS Y ROLES
Para cada tipo de usuario (mínimo 3):
### Persona: [Nombre ficticio], [Rol]
- Perfil, Dispositivos, Frecuencia uso, Nivel técnico, Dolor principal, Rol en el sistema, Pantallas principales
## 4.1 Matriz de permisos
| Recurso/Acción | [Rol 1] | [Rol 2] | [Rol 3] |

# 5. FLUJOS PRINCIPALES
Para cada flujo core (mínimo 3):
### Flujo: [Nombre]
| Paso | Actor | Acción en UI | Query/Mutation Supabase | Estado resultante |
Edge cases con respuesta UI + manejo técnico.

IMPORTANTE: Genera SOLO secciones 1-5. Sé exhaustivo. Termina con: ---END_PART_1---`;

      console.log("[PRD] Starting Part 1/4 (Sections 1-5)...");
      const result1 = await callPrdModel(prdSystemPrompt, userPrompt1);
      totalTokensInput += result1.tokensInput;
      totalTokensOutput += result1.tokensOutput;
      console.log(`[PRD] Part 1 done: ${result1.tokensOutput} tokens`);

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 2: Sections 6-10 (Módulos, Requisitos, NFR, Datos, Integraciones)
      // ═══════════════════════════════════════════════════════════════════════
      const userPrompt2 = `CONTEXTO:
DOCUMENTO FINAL: ${finalStr}
AI LEVERAGE: ${aiLevStr}
BRIEFING: ${briefStr}

PARTE 1 YA GENERADA (para continuidad):
${result1.text}

GENERA LAS SECCIONES 6 A 10 DEL PRD EN MARKDOWN:

# 6. MÓDULOS DEL PRODUCTO
Para CADA módulo:
## 6.X [Nombre del Módulo] — Fase [N] — [P0/P1/P2]
- Pantallas: lista con ruta (ej: /dashboard/farmacias → FarmaciasList)
- Entidades: tablas de BD involucradas
- Edge Functions: funciones IA (si aplica)
- Dependencias: qué módulos deben existir antes

# 7. REQUISITOS FUNCIONALES
Para cada módulo, user stories:
### RF-001: [Título]
- Como [rol] quiero [acción] para [beneficio]
- Criterios de aceptación: DADO/CUANDO/ENTONCES con métricas
- Prioridad y Fase

# 8. REQUISITOS NO FUNCIONALES
| ID | Categoría | Requisito | Métrica | Herramienta |
Incluir: Rendimiento, Seguridad, RGPD, Disponibilidad, Accesibilidad.

# 9. DATOS Y MODELO
## 9.1 Schema SQL (ejecutable en Supabase)
CREATE TABLE completo para CADA tabla con tipos, constraints, defaults.
IMPORTANTE: Supabase usa auth.users para autenticación. NO crear tabla "usuarios" con email/password. La tabla perfiles REFERENCIA auth.users(id).
## 9.2 RLS Policies completas
Para CADA tabla, policies de seguridad.
## 9.3 Storage Buckets
| Bucket | Visibilidad | Max size | Tipos | Acceso |
## 9.4 Diagrama Mermaid de relaciones

# 10. INTEGRACIONES
| Sistema | Tipo | Endpoint | Auth | Rate limit | Fallback | Edge Function | Secrets |

IMPORTANTE: Genera SOLO secciones 6-10. Termina con: ---END_PART_2---`;

      console.log("[PRD] Starting Part 2/4 (Sections 6-10)...");
      const result2 = await callPrdModel(prdSystemPrompt, userPrompt2);
      totalTokensInput += result2.tokensInput;
      totalTokensOutput += result2.tokensOutput;
      console.log(`[PRD] Part 2 done: ${result2.tokensOutput} tokens`);

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 3: Sections 11-15 (IA, Telemetría, Riesgos, Fases, Anexos)
      // ═══════════════════════════════════════════════════════════════════════
      const userPrompt3 = `CONTEXTO:
DOCUMENTO FINAL: ${finalStr}
AI LEVERAGE: ${aiLevStr}
BRIEFING: ${briefStr}

PARTES 1 Y 2 YA GENERADAS:
${result1.text}
---
${result2.text}

GENERA LAS SECCIONES 11 A 15 DEL PRD EN MARKDOWN:

# 11. DISEÑO DE IA
Para CADA componente IA MVP/Fase1-2:
## AI-XXX: [Nombre]
- Edge Function: nombre
- Trigger: qué lo dispara
- Modelo/Proveedor: nombre exacto
- Input/Output ejemplo: JSON
- Prompt base (resumido)
- Fallback: qué pasa si falla
- Guardrails: límites (max tokens, timeout, validación output)
- Logging: INSERT INTO auditoria_ia
- Métricas de calidad
- Coste/operación
- Secrets en Supabase Vault

# 12. TELEMETRÍA Y ANALÍTICA
## 12.1 Eventos a trackear
| Evento | Trigger | Datos | Tabla destino |
## 12.2 KPIs dashboard admin
| KPI | Query SQL | Frecuencia | Alerta si... |
## 12.3 Alertas automáticas

# 13. RIESGOS Y MITIGACIONES
| ID | Riesgo | Probabilidad | Impacto | Mitigación técnica | Responsable | Indicador activación |

# 14. PLAN DE FASES
Para CADA fase:
## Fase X: [Nombre] (X semanas)
- Pantallas nuevas (con rutas)
- Tablas nuevas
- Edge Functions nuevas
- Componentes nuevos
- Criterio de éxito (medible)
- Coste estimado (rango)

# 15. ANEXOS
## 15.1 Glosario de términos del dominio
## 15.2 Checklist pre-desarrollo

IMPORTANTE: Genera SOLO secciones 11-15. Termina con: ---END_PART_3---`;

      console.log("[PRD] Starting Part 3/4 (Sections 11-15)...");
      const result3 = await callPrdModel(prdSystemPrompt, userPrompt3);
      totalTokensInput += result3.tokensInput;
      totalTokensOutput += result3.tokensOutput;
      console.log(`[PRD] Part 3 done: ${result3.tokensOutput} tokens`);

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 4: BLUEPRINT LOVABLE (copy/paste) + SPECS D1/D2
      // ═══════════════════════════════════════════════════════════════════════
      const userPrompt4 = `PARTES 1, 2 Y 3 DEL PRD YA GENERADAS:

PARTE 1:
${result1.text}

PARTE 2:
${result2.text}

PARTE 3:
${result3.text}

FASE OBJETIVO PARA EL BLUEPRINT: ${targetPhase}

Genera DOS bloques separados:

---

# LOVABLE BUILD BLUEPRINT

> Este bloque está diseñado para copiarse y pegarse DIRECTAMENTE en Lovable.dev.
> Contiene SOLO lo necesario para construir la fase indicada.
> NO incluir funcionalidades de fases futuras.

## Contexto
[2-3 líneas: qué es la app, para quién, qué fase se construye]

## Stack
React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase
Deps npm: react-router-dom, @supabase/supabase-js, lucide-react, recharts

## Pantallas y Rutas
| Ruta | Componente | Acceso | Descripción |
(SOLO las pantallas de la fase objetivo)

## Wireframes Textuales
Para CADA pantalla, describir:
- Layout (sidebar? header? grid?)
- Componentes visibles (cards, tablas, formularios, botones)
- Estados (loading, empty, error, success)
- Query Supabase que alimenta los datos

## Componentes Reutilizables
| Componente | Descripción | Usado en |

## Base de Datos
\`\`\`sql
-- SOLO las tablas necesarias para esta fase
-- Incluir RLS policies
-- Incluir Storage buckets
\`\`\`

## Edge Functions
Para cada una: Nombre, trigger, proceso, fallback, secrets

## Design System
- Colores: primary, secondary, accent, danger, background, surface
- Tipografía: heading + body
- Bordes, sombras, iconos
- Tono visual

## Auth Flow
Supabase Auth con email+password. Redirect post-login según rol.

## QA Checklist
- [ ] Todas las rutas cargan sin error
- [ ] Auth funciona (registro + login + redirect por rol)
- [ ] RLS impide acceso no autorizado
- [ ] Estados vacíos muestran mensaje apropiado
- [ ] Edge Functions responden correctamente
- [ ] Responsive en mobile

---

# SPECS PARA FASES POSTERIORES DEL PIPELINE (NO pegar en Lovable)

## D1 — Spec RAG (Fase 8)
- Fuentes de conocimiento, estrategia de chunking, quality gates, categorías, endpoints de consulta

## D2 — Spec Detector de Patrones (Fase 9)
- Señales a analizar, output esperado, métricas de calidad

Termina con: ---END_PART_4---`;

      console.log("[PRD] Starting Part 4/4 (Blueprint + Specs)...");
      const result4 = await callPrdModel(prdSystemPrompt, userPrompt4);
      totalTokensInput += result4.tokensInput;
      totalTokensOutput += result4.tokensOutput;
      console.log(`[PRD] Part 4 done: ${result4.tokensOutput} tokens`);

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 5: VALIDATION (different model — Claude as auditor)
      // ═══════════════════════════════════════════════════════════════════════
      const validationSystemPrompt = `Eres un auditor técnico de PRDs. Recibes las 4 partes de un PRD y verificas su consistencia interna. NO reescribes nada — solo señalas problemas.

REGLAS:
- Verifica que los nombres de módulos son IDÉNTICOS entre todas las partes.
- Verifica que los nombres de tablas SQL coinciden con las entidades en flujos y módulos.
- Verifica que cada pantalla del Blueprint tiene wireframe textual.
- Verifica que cada Edge Function del Blueprint está documentada en IA (sección 11).
- Verifica que las fases son consistentes (sin saltos ni contradicciones).
- Verifica que los RLS policies cubren todos los flujos de acceso.
- Verifica que el stack es SOLO React+Vite+Supabase (sin Next.js, Express, AWS).
- Verifica que los nombres propios están correctamente escritos.
- Responde SOLO con JSON válido.`;

      // Truncate parts for validation (only need key sections, not full text)
      const truncateForValidation = (s: string, max = 8000) => s.length > max ? s.substring(0, max) + "\n[...truncado para validación]" : s;

      const validationPrompt = `PRD PARTE 1 (resumen):
${truncateForValidation(result1.text)}

PRD PARTE 2 (resumen):
${truncateForValidation(result2.text)}

PRD PARTE 3 (resumen):
${truncateForValidation(result3.text)}

PRD PARTE 4 (Blueprint):
${truncateForValidation(result4.text)}

Analiza las 4 partes y devuelve:
{
  "consistencia_global": 0-100,
  "issues": [
    {
      "id": "PRD-V-001",
      "severidad": "CRÍTICO/IMPORTANTE/MENOR",
      "tipo": "NOMBRE_INCONSISTENTE/TABLA_FALTANTE/PANTALLA_SIN_WIREFRAME/RLS_INCOMPLETO/STACK_INCORRECTO/FASE_INCONSISTENTE/TYPO_NOMBRE_PROPIO",
      "descripción": "descripción concreta",
      "ubicación": "parte(s) y sección(es)",
      "corrección_sugerida": "qué debería decir"
    }
  ],
  "resumen": "X issues: Y críticos, Z importantes. Veredicto.",
  "nombres_verificados": {
    "empresa_cliente": "nombre correcto según briefing",
    "stakeholders": ["nombre — OK/INCORRECTO"],
    "producto": "nombre correcto"
  }
}`;

      console.log("[PRD] Starting validation call (Claude Sonnet as auditor)...");
      let validationResult: { text: string; tokensInput: number; tokensOutput: number };
      let validationData: any = null;
      try {
        validationResult = await callClaudeSonnet(validationSystemPrompt, validationPrompt);
        totalTokensInput += validationResult.tokensInput;
        totalTokensOutput += validationResult.tokensOutput;
        console.log(`[PRD] Validation done: ${validationResult.tokensOutput} tokens`);

        // Parse validation JSON
        try {
          let cleaned = validationResult.text.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          validationData = JSON.parse(cleaned.trim());
        } catch {
          console.warn("[PRD] Validation JSON parse failed, continuing without validation data");
          validationData = { consistencia_global: -1, issues: [], resumen: "Validation parse failed" };
        }
      } catch (validationError) {
        console.warn("[PRD] Validation call failed, continuing without validation:", validationError instanceof Error ? validationError.message : validationError);
        validationData = { consistencia_global: -1, issues: [], resumen: "Validation call failed" };
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CONCATENATE & CLEAN
      // ═══════════════════════════════════════════════════════════════════════
      const fullPrd = [result1.text, result2.text, result3.text, result4.text]
        .join("\n\n")
        .replace(/---END_PART_[1-4]---/g, "")
        .trim();

      // Extract Blueprint section separately for easy copy/paste
      const blueprintMatch = fullPrd.match(/# LOVABLE BUILD BLUEPRINT[\s\S]*?(?=# SPECS PARA FASES|$)/);
      const blueprint = blueprintMatch ? blueprintMatch[0].trim() : "";

      // Extract D1/D2 specs separately
      const specsMatch = fullPrd.match(/# SPECS PARA FASES[\s\S]*$/);
      const specs = specsMatch ? specsMatch[0].trim() : "";

      // ═══════════════════════════════════════════════════════════════════════
      // COST CALCULATION
      // ═══════════════════════════════════════════════════════════════════════
      // Gemini Pro 2.5: $1.25/M input, $5.00/M output (if all calls used Gemini)
      // Claude Sonnet 4: $3.00/M input, $15.00/M output (if fallback was used)
      // Validation call always uses Claude Sonnet
      const generativeTokensInput = totalTokensInput - (validationResult?.tokensInput || 0);
      const generativeTokensOutput = totalTokensOutput - (validationResult?.tokensOutput || 0);

      const generativeRates = prdFallbackUsed
        ? { input: 3.00, output: 15.00 }   // Claude rates
        : { input: 1.25, output: 5.00 };    // Gemini Pro rates

      const generativeCost = (generativeTokensInput / 1_000_000) * generativeRates.input +
                             (generativeTokensOutput / 1_000_000) * generativeRates.output;

      const validationCost = validationResult
        ? (validationResult.tokensInput / 1_000_000) * 3.00 + (validationResult.tokensOutput / 1_000_000) * 15.00
        : 0;

      const costUsd = generativeCost + validationCost;

      // Record cost
      await recordCost(supabase, {
        projectId,
        stepNumber: 7,
        service: mainModelUsed,
        operation: "generate_prd",
        tokensInput: totalTokensInput,
        tokensOutput: totalTokensOutput,
        costUsd,
        userId: user.id,
        metadata: {
          parts: 4,
          validation: true,
          tokens_part1: result1.tokensOutput,
          tokens_part2: result2.tokensOutput,
          tokens_part3: result3.tokensOutput,
          tokens_part4: result4.tokensOutput,
          tokens_validation: validationResult?.tokensOutput || 0,
          consistencia_global: validationData?.consistencia_global || -1,
          validation_issues_count: validationData?.issues?.length || 0,
          fallback_used: prdFallbackUsed,
          generative_model: mainModelUsed,
          target_phase: targetPhase,
        },
      });

      // ═══════════════════════════════════════════════════════════════════════
      // SAVE
      // ═══════════════════════════════════════════════════════════════════════
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 7)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 7,
        step_name: "PRD Técnico",
        status: "review",
        input_data: { action: "generate_prd", targetPhase },
        output_data: {
          document: fullPrd,
          blueprint,
          specs,
          validation: validationData,
        },
        model_used: mainModelUsed,
        version: newVersion,
        user_id: user.id,
      });

      // Save full PRD as document
      await supabase.from("project_documents").insert({
        project_id: projectId,
        step_number: 7,
        version: newVersion,
        content: fullPrd,
        format: "markdown",
        user_id: user.id,
      });

      // Save Blueprint as separate document (for easy retrieval)
      if (blueprint) {
        await supabase.from("project_documents").insert({
          project_id: projectId,
          step_number: 7,
          version: newVersion,
          content: blueprint,
          format: "markdown",
          user_id: user.id,
          // If your table has a 'document_type' or 'metadata' column, use it:
          // metadata: { type: "lovable_blueprint", target_phase: targetPhase },
        });
      }

      await supabase.from("business_projects").update({ current_step: 7 }).eq("id", projectId);

      return new Response(JSON.stringify({
        output: {
          document: fullPrd,
          blueprint,
          specs,
          validation: validationData,
        },
        cost: costUsd,
        version: newVersion,
        modelUsed: mainModelUsed,
        fallbackUsed: prdFallbackUsed,
        parts: 4,
        validation: {
          consistencia: validationData?.consistencia_global || -1,
          issues: validationData?.issues?.length || 0,
          resumen: validationData?.resumen || "N/A",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
