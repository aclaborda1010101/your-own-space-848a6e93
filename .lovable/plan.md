# Plan: arreglar 3 problemas concretos del wizard

## Diagnóstico

### 1. "Aprobar briefing" no hace nada visible
En la sesión actual el log de la edge function **no muestra** ningún `approve_step` para step 2 — solo step 4. Step 2 sigue en `status=review` v9 con `approved_at = NULL`. Hipótesis: el usuario pulsó el botón pero `approveStep(2, …)` se quedó esperando porque dispara primero `normalizeBrief()` cuando detecta que el brief limpio podría no estar al día — y como ya hay v9 con `_clean_brief_md` válido, esa rama no debería ejecutarse. Lo más probable es que el `editedBriefing` que se pasa al backend incluye `_clean_brief_md` pero la cadena `normalizeBrief()` se ejecuta igualmente en otro punto, o el toast/reload simplemente no se vio. Hay además un error en logs de un update con enum `jarvis_job_status` que **no es** del approve real (es de otra ruta) pero ensucia la traza.

### 2. Sigue habiendo inglés mezclado
El detector `isLikelyEnglish` exige >18% de palabras del listado `EN_HINT_WORDS` para activar la traducción LLM. Frases como *"Information on 70% of potential clients, incluyendo DNI, birth dates, and family contacts"* tienen suficientes números/términos propios para diluir ese ratio por debajo del umbral, así que **nunca entran al batch de traducción**. El `applyDeterministicSpanishCleanup` solo cubre frases enteras concretas, no fragmentos sueltos como `data on`, `suggests`, `represents`, `implying`, `is available`, etc.

### 3. UI de presupuesto y propuesta cliente "desaparecida"
- El selector `pricingMode` (sin cifras / rangos / detalle completo) vivía dentro de `ProjectWizardStep3.tsx` (RadioGroup), pero el wizard actual ya **no usa ese componente**: renderiza `ProjectWizardGenericStep` para step 3 (PRD Técnico). El estado `pricingMode` se sigue pasando a `runChainedPRD`, pero el control visual ya no aparece en ningún sitio.
- `ProjectBudgetPanel` solo se monta cuando `step3.status === "approved"`. En el proyecto actual step 3 está en `review`, por eso no se ve. Igual con `ProjectProposalExport` (necesita además `budgetData`). El usuario percibe que "ha desaparecido" porque generó el PRD pero no lo aprobó.

---

## Cambios

### A. Brief Limpio: traducción agresiva sin heurística de ratio
`supabase/functions/project-wizard-step/brief-normalizer.ts`

1. **Nueva señal `hasEnglishFragment`** que dispare con CUALQUIER fragmento sospechoso (lista ampliada, ~80 patrones cortos: `\bdata on\b`, `\bsuggests\b`, `\brepresents\b`, `\bimplying\b`, `\bare available\b`, `\bvaluable insights\b`, `\bin order to\b`, `\bsuch as\b`, `\bwhich is\b`, `\bcontain\b`, `\bare not fully\b`, `\bis currently\b`, `\bemails over\b`, `\byears of\b`, `\bcurrently not\b`, `\bbirth dates\b`, `\bfamily contacts\b`, `\bpersonalized outreach\b`, `\boff-market\b`, `\bclients potential\b`, etc.).
2. **`isLikelyEnglish` pasa a OR**: `EN_PHRASE_RE.test(s) || hasEnglishFragment(s) || ratio > 0.18`. Así cualquier item con un solo trigger entra al batch de traducción LLM.
3. **`applyDeterministicSpanishCleanup` ampliado** con ~50 reemplazos puente más: `data on real estate off-market` → `datos sobre activos inmobiliarios fuera de mercado`, `suggests a structured data source that can be further utilized` → `sugiere una fuente de datos estructurada que puede explotarse mejor`, `Information on X% of potential clients` → `Información sobre el X% de los clientes potenciales`, `birth dates, and family contacts` → `fechas de nacimiento y contactos familiares`, `49,000 emails from 15 years of commercial negotiations contain valuable insights` → `49.000 correos de 15 años de negociaciones comerciales contienen información valiosa`, `Existing CRM data … is not fully cataloged` → `Los datos del CRM existentes … no están completamente catalogados`, `the possibility of monitoring and analyzing` → `la posibilidad de monitorizar y analizar`, `to improve conversion and discourse, implying these recordings are available but not fully utilized` → `para mejorar la conversión y el discurso; estas grabaciones están disponibles pero no se aprovechan plenamente`, etc. Aplicado **siempre**, también después del LLM, para cazar lo que aún quede.
4. **Nueva pasada final `stripResidualEnglishTokens`**: si tras todo lo anterior un string sigue conteniendo trigger fragments, se reemplazan los más comunes con sus equivalentes españoles uno a uno (tabla pequeña de ~30 palabras puente: `data`→`datos`, `clients`→`clientes`, `emails`→`correos`, `recordings`→`grabaciones`, `available`→`disponibles`, `valuable`→`valiosa`, `insights`→`información`, etc.) para minimizar lo que pase al PDF final.
5. **Pasada también sobre `_clean_brief_md`** (no solo sobre el JSON v2): el clean brief se reconstruye desde v2, pero hago una pasada de `applyDeterministicSpanishCleanup` también sobre el markdown final como red de seguridad antes de persistirlo.

### B. UI de presupuesto y selector de pricing — siempre accesibles
`src/pages/ProjectWizard.tsx`

1. **Mover el selector `pricingMode`** (RadioGroup con sin cifras / rangos / detalle completo) **fuera** de `ProjectWizardStep3` — extraerlo a un mini-componente `PricingModeSelector` que se renderiza **siempre** dentro de step 3 (encima del bloque de PRD), tanto antes como después de generar.
2. **Renderizar `ProjectBudgetPanel`** cuando `step3.outputData` exista (no solo cuando esté aprobado). Mantener un aviso visible "El PRD aún no está aprobado — al aprobarlo se incorporará al presupuesto" si `status !== approved`, pero ya permitir generar/editar modelos de monetización.
3. **Renderizar `ProjectProposalExport`** cuando `budgetData` exista (no exigir PRD aprobado), con el mismo aviso suave si el budgetStatus no es `approved`.
4. Todo el flujo de auto-chain (aprobar PRD → presupuesto → propuesta) sigue funcionando igual; solo se relaja el gating visual para que el usuario no se "quede sin pantalla".

### C. Aprobación de briefing fiable
`src/hooks/useProjectWizard.ts` + `src/components/projects/wizard/ProjectWizardStep2.tsx`

1. En `approveStep` (ya existe el pre-check Step 2 → normalizeBrief si falta brief limpio): añadir **log explícito** con `console.info` antes y después del invoke, y un **toast.error claro** si la respuesta tiene `error` (ya lanza, pero el `try/catch` envuelve todo y a veces silencia). Cambiar a chequeo de `data?.error` además de `error` del wrapper.
2. En el botón "Aprobar briefing" del Step2: añadir **estado local `approving`** controlado por `handleApprove` (set true, await, set false), deshabilitar el botón y mostrar `Loader2` mientras corre. Hoy el botón solo se deshabilita por `normalizing`, así que si la llamada tarda 5 s sin mostrar feedback el usuario cree que "no hace nada".
3. En la edge function (`project-wizard-step/index.ts`, sección `approve_step`): si la actualización de `project_wizard_steps` falla con error de enum, **devolver 500 con mensaje claro** en vez de loguear y devolver 200. Hoy `if (updErr) console.error(...)` y luego sigue con éxito → el frontend toastea "Paso aprobado" aunque la fila no se haya actualizado. Cambiar a `if (updErr) return 500 { error: updErr.message }`.

---

## Criterio de aceptación

1. Pulsar "Aprobar briefing" muestra loader, después toast de éxito (o error explícito), y el step 2 pasa a `status=approved` con `approved_at` set en BD. Si algo falla, sale toast con el motivo real.
2. El Brief Limpio v10 generado tras `normalizeBrief` ya no contiene fragmentos como `data on`, `suggests a`, `valuable insights`, `birth dates`, `is currently not`, `not fully utilized`, `vast amount of`, etc. Una búsqueda por esos términos en `_clean_brief_md` devuelve 0 hits.
3. En la pantalla de step 3 aparece **siempre** el selector "Cifras de inversión" (sin cifras / rangos / detalle completo) por encima del PRD, generado o no.
4. En cuanto exista `step3.outputData` (PRD generado, esté o no aprobado), aparece `ProjectBudgetPanel` con la selección de modelos de monetización. En cuanto exista `budgetData`, aparece `ProjectProposalExport` con el botón de descargar la propuesta cliente.
5. La regeneración del PDF del Brief Limpio sigue siendo `Limpiar y normalizar` → `Exportar PDF`, sin re-extraer desde chunks.
