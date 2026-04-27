# Plan: Regenerar Step 29 + Step 32 para AFFLUX y validar

## Estado actual (verificado en DB)

| Step | Version | Apunta a | Problema |
|---|---|---|---|
| 28 | **v2** ✅ | — | Correcto: SCOPE-007 movido a F2 (df=1, mvp=13, f2=2) |
| 29 | v1 ⚠️ | Step 28 **v1** | Desfasado: leyó scope antiguo con revista emocional en MVP |
| 32 | v1 ⚠️ | Step 29 v1 | Generado **antes** de los 4 ajustes de empaquetado (buildings, agente Compliance/HITL, WhatsApp mock, orden secuencial MVP) |

**Código deployado**: confirmado que `f9-lovable-build-pack.ts` ya contiene los 4 ajustes (entidad `buildings`, `Agente Compliance / HITL`, WhatsApp como `interfaz/estado/mock`, `sortMvpForBuildOrder`). Solo falta regenerar.

## Por qué no puedo ejecutar el action ahora
- El curl directo al edge function `generate_lovable_build_pack` devuelve **401 Unauthorized** (la sesión browser no propaga el JWT al call server-side desde el sandbox).
- La regeneración tiene que dispararse desde tu sesión autenticada en la UI (PipelineQAPanel) — o bien aceptar que la haga vía SQL leyendo Step 28 v2 + invocando el módulo determinista en local (ver Paso 3 alt).

## Pasos

### 1. Regenerar Step 29 v2 (PRD técnico) leyendo Step 28 v2
- Acción: tú pulsas **"Regenerar PRD técnico"** en la UI del wizard (Step 3).
- Resultado esperado: Step 29 sube a `version=2`, su `source_scope_row_id` apunta a `c9e3ac94...` y `source_scope_version=2`. El nuevo PRD reflejará: mvp=13, f2=2 (Benatar + Revista emocional).
- Patrón: UPDATE in-place (mismo que usamos con Step 28, por el constraint UNIQUE).

### 2. Regenerar Step 32 v2 (Lovable Build Pack)
- Acción: tú pulsas **"Generar Lovable Build Pack (Step 32)"** en `PipelineQAPanel`.
- Resultado esperado: Step 32 sube a `version=2`, `source_prd_row_id=b25c43c4...`, `source_prd_version=2`, `source_scope_version=2`.

### 3. Validación automática del checklist (12 puntos)
Una vez completados pasos 1-2, leo Step 32 v2 desde DB y devuelvo:

- [ ] **(1)** version, row_id, source_prd_row_id, source_scope_row_id, word_count, warnings
- [ ] **(2)** Trazabilidad PRD↔Scope correcta
- [ ] **(3)** Counts por bucket
- [ ] **(4)** Extracto markdown secciones 3, 4, 6, 7, 8, 9
- [ ] **(5)** Sección 3 contiene entidad `buildings` con todos los campos requeridos
- [ ] **(6)** Sección 4 MVP en orden secuencial (datos → llamadas → RAG → catalogador → asistente → compliance/HITL → fallecimientos → matching → valoración → MoE → cadencias/WhatsApp)
- [ ] **(7)** WhatsApp explícito como mock/controlado (sin envío real)
- [ ] **(8)** Sección 6 con 5 sub-bloques (RAGs, Agentes, MoE/Router, Tools, HITL)
- [ ] **(9)** "Agente Compliance / HITL" presente
- [ ] **(10)** Sección 8 incluye Benatar, revista emocional, no envío WhatsApp, no scraping real, no scoring final, no contacto sin revisión
- [ ] **(11)** Criterios de aceptación con WhatsApp sin envío, HITL en sensibles, matching con justificación, no fast-follow en MVP
- [ ] **(12)** Sin jerga interna (Step 25/28, Component Registry, Edge Function, RLS, SQL, F4, F5)

Y entrego el extracto markdown completo de las secciones 3, 4, 6, 7, 8 y 9.

### 4. Si la validación falla
- Si bucket integrity falla → diagnostico qué componente se movió.
- Si word_count fuera de [1500, 2500] → reporto warning sin regenerar (según tu instrucción del checklist punto 8 anterior).
- Si jerga interna se cuela → diagnostico el origen (probablemente PRD upstream) y propongo strip extra.

## Lo que NO hago
- No toco `f9-lovable-build-pack.ts` (ya está correcto).
- No toco propuesta cliente, presupuesto, ni scope.
- No regenero Step 25-28 (Step 28 v2 ya es la verdad).
- No meto Step 32 en auto-chain.

## Acción que necesito de ti tras aprobar el plan
1. Pulsar "Regenerar PRD técnico" en Step 3 del wizard.
2. Esperar a que termine.
3. Pulsar "Generar Lovable Build Pack (Step 32)" en `PipelineQAPanel`.
4. Avisarme — yo leo DB y entrego validación + extractos.

Alternativa: si prefieres que invoque yo los actions vía edge function tras aprobar el plan, puedo intentar pasar tu JWT capturado o usar `SUPABASE_SERVICE_ROLE_KEY` desde un script. Avísame si quieres esa ruta y lo añado al plan.
