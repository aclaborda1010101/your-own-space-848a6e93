## Diagnóstico

Confirmé los 4 problemas con código y BBDD:

1. **El proyecto AFFLUX (`6ef807d1…`) NO tiene Step 28 persistido** (solo 1, 2, 6 y 11). La auto-cadena de prerequisitos en `useProjectWizard.generateClientProposal` no está fallando ruidosamente — está silenciando el error y la propuesta acaba leyendo otra fuente. **Por eso el alcance "se reinventa": F7 no encuentra Step 28 y, o bien rompe, o se está sirviendo el PDF legacy del Step 11**. El primer fix es hacer la auto-cadena hard-fail y bloquear la generación si Step 28 no existe.

2. **Mismatch de schema entre `budgetToCommercialTermsV1` (frontend) y `CommercialTermsV1` (F7)**:
   - El mapper produce `{pricing_model, selected_models:[{setup_fee, monthly_fee, …}], development_total_eur, recurring_monthly_eur, …}`.
   - F7 lee `commercialTerms.setup_fee` y `commercialTerms.monthly_retainer` **al nivel raíz**, que no existen → por eso el PDF solo dice "Modalidad: setup_plus_monthly" sin importes.
   - **Fix**: el mapper debe aplanar el modelo recomendado/visible a los campos planos que F7 espera (`setup_fee`, `monthly_retainer`, `phase_prices`, `ai_usage_cost_policy`, `taxes`, `payment_terms`, `optional_addons`).

3. **Cliente mal identificado**: `business_projects.company = "Alejandro Gordo"` (decisor metido como empresa) y `name = "AFFLUX"`. La propuesta hace `clientName = companyName ?? company`, por lo que sale "Alejandro Gordo" como cliente.
   - **Fix**: separar conceptualmente `client_company` (AFLU/AFFLUX) y `decision_maker` (Alejandro Gordo). Añadir campo opcional `decision_maker_name` en `business_projects` y propagarlo a F7. Cabecera y portada deben usar `client_company`; "Decisor" se muestra como dato secundario.

4. **Formato/ES**: F7 emite `weeks_window.replace(/_/g, " ")` → "weeks 1 to 2". Y la numeración salta de 12 a 14 cuando no hay `support_terms`.

5. **Validación**: F7 no bloquea si faltan importes. Hay que añadir guards.

---

## Plan de implementación

### A. `src/lib/budgetToCommercialTerms.ts` — aplanar para F7

Cambiar `budgetToCommercialTermsV1()` para que devuelva (además del objeto interno) los campos planos que F7 espera. La forma:

```ts
return {
  // ── campos planos para F7 (Step 30) ──
  pricing_model: "setup_plus_monthly" | "subscription" | "fixed_project" | "phased",
  setup_fee: number | undefined,        // del modelo visible/recomendado
  monthly_retainer: number | undefined, // del modelo visible/recomendado
  phase_prices: undefined,
  optional_addons: [...otros modelos visibles no recomendados con su precio],
  ai_usage_cost_policy: "Costes de IA/API no incluidos por defecto…",
  payment_terms: budget.pricing_notes || default,
  taxes: "IVA no incluido. Se aplicará el tipo vigente.",
  currency: "EUR",
  validity_days: 30,

  // ── extras internos (para auditoría / no renderizado) ──
  selected_models, recommended_model,
  development_total_eur, recurring_monthly_eur,
  notes, risk_factors,
  source: "derived_from_budget_data",
};
```

Endurecer `validateBudgetForClientProposal`: el modelo visible al cliente **debe** tener al menos `setup_fee` o `monthly_fee` numérico tras `parseEuro` (no string vacío, no rango sin número).

### B. `supabase/functions/project-wizard-step/f7-proposal-builder.ts`

1. **Guard de presupuesto** al inicio de `buildClientProposal`:
   ```ts
   const hasBudget =
     typeof commercialTerms.setup_fee === "number" ||
     typeof commercialTerms.monthly_retainer === "number" ||
     (commercialTerms.phase_prices?.length ?? 0) > 0;
   if (!hasBudget) throw new Error("MISSING_BUDGET_AMOUNTS");
   ```

2. **Cliente vs decisor** — extender `F7Input`:
   ```ts
   clientCompany: string;       // p.ej. "AFLU / AFFLUX"
   decisionMakerName?: string;  // p.ej. "Alejandro Gordo"
   ```
   Renderizar:
   ```
   **Cliente / empresa:** AFLU / AFFLUX
   **Decisor:** Alejandro Gordo
   **Producto:** AFFLUX
   ```
   Cabecera: `CONFIDENCIAL — {clientCompany}`.

3. **ES nativo del weeks_window** — pequeño map:
   ```ts
   const WEEKS_ES = {
     weeks_1_to_2: "semanas 1 y 2",
     weeks_1_to_4: "semanas 1 a 4",
     // …
   };
   ```
   Fallback: si no está en el map, traducir `weeks_X_to_Y` → `semanas X a Y`.

4. **Numeración estable** del markdown: renumerar dinámicamente las secciones (no hardcoded `## 12`, `## 14`). Mantener un contador `n` y emitir `## ${n++}. Título`.

5. **Renderizado de presupuesto siempre presente**: si hay `setup_fee`, mostrar línea; si hay `monthly_retainer`, mostrar línea; nunca quedarse solo con "Modalidad: …".

### C. `supabase/functions/project-wizard-step/index.ts` — handler `generate_client_proposal`

1. **Bloquear si no hay Step 28** (ya lo hace) → mantener pero con código de error explícito `NO_STEP_28`.

2. **Bloquear si el scope de Step 28 está vacío o desalineado**: validar `mvp.length + data_foundation.length >= 1`. Si está vacío → error `EMPTY_SCOPE`.

3. **Pasar `clientCompany` y `decisionMakerName`** al builder:
   - `clientCompany`: leer de `stepData.clientCompany` o, fallback, `business_projects.client_company` (nuevo campo) o `business_projects.name`.
   - `decisionMakerName`: leer de `stepData.decisionMakerName` o `business_projects.decision_maker_name` o `business_projects.company` legacy.

4. **Devolver 422 con `MISSING_BUDGET_AMOUNTS`** si el throw del builder lo indica, para que el frontend pueda mostrar mensaje claro.

### D. `src/hooks/useProjectWizard.ts`

1. **Auto-cadena hard-fail**: tras cada prereq verificar en BBDD que el step se persistió antes de seguir. Si no → toast.error y abortar (ya estaba parcialmente, asegurar para los 4 prereqs).

2. **Pasar `clientCompany` y `decisionMakerName`** al body del invoke:
   ```ts
   stepData: {
     commercial_terms_v1,
     projectName: project.name,                      // "AFFLUX"
     clientCompany: project.client_company || project.name,  // "AFLU / AFFLUX"
     decisionMakerName: project.decision_maker_name || project.company,  // "Alejandro Gordo"
   }
   ```

### E. Migración BBDD

Añadir a `business_projects`:
- `client_company TEXT` (empresa cliente; AFLU/AFFLUX para este proyecto)
- `decision_maker_name TEXT` (decisor; Alejandro Gordo para este proyecto)

Backfill solo del proyecto AFFLUX:
```sql
UPDATE business_projects
SET client_company = 'AFLU / AFFLUX',
    decision_maker_name = 'Alejandro Gordo'
WHERE id = '6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf';
```

### F. UI — exposición mínima

En `ProjectBudgetPanel` o `ProjectProposalExport` (sin rediseñar): permitir editar dos inputs "Empresa cliente" y "Decisor" si están vacíos antes de generar la propuesta. No bloqueante en otras pantallas.

### G. Tests Deno

Actualizar `f7-proposal-builder_test.ts`:
- Test nuevo: `buildClientProposal` lanza `MISSING_BUDGET_AMOUNTS` si no hay setup/monthly/phase prices.
- Test nuevo: el markdown renderizado usa `clientCompany` en cabecera y muestra `Decisor:` aparte.
- Test nuevo: `weeks_1_to_2` se traduce a `semanas 1 y 2`.
- Test nuevo: la numeración nunca salta (regex `## (\d+)\.` → secuencia 1..N consecutiva).
- Test nuevo: scope con `data_foundation:1, mvp:9, fast_follow:2, roadmap:0` → `mvp_scope.length === 10` (1+9), `later_phases.fast_follow.length === 2`, `later_phases.roadmap.length === 0` y la sección "Roadmap posterior" se omite (no "_No aplica._").

### H. Roadmap vacío

Cambio menor en el renderer: si `roadmap.length === 0`, **no** emitir la subsección "Roadmap posterior" en absoluto (en vez de `_No aplica._`). Igual para "Qué queda fuera" si está vacío.

---

## Criterio de aceptación (para AFFLUX)

1. Al pulsar "Generar propuesta cliente" sin Step 28 → toast claro y NO se persiste Step 30.
2. Tras correr la auto-cadena (build_registry → architect_scope), Step 28 v2 existe con buckets `data_foundation:1, mvp:9, fast_follow:2, roadmap:0`.
3. La propuesta:
   - Cabecera: `CONFIDENCIAL — AFLU / AFFLUX`.
   - Datos: `Cliente / empresa: AFLU / AFFLUX`, `Decisor: Alejandro Gordo`, `Producto: AFFLUX`.
   - Alcance MVP: 10 ítems (Soul + 9 MVP).
   - Fases posteriores: 2 (revista emocional, Benatar).
   - Sin sección Roadmap.
   - Presupuesto con `Cuota inicial` y `Mensualidad` numéricas reales del modelo recomendado.
   - "semanas 1 y 2" en lugar de "weeks 1 to 2".
   - Numeración consecutiva 1..N.
4. Tests Deno verdes.

---

## Ficheros a tocar

- `src/lib/budgetToCommercialTerms.ts` (aplanar + validación estricta)
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts` (guard, cliente/decisor, weeks_es, numeración, roadmap-vacío)
- `supabase/functions/project-wizard-step/f7-proposal-builder_test.ts` (5 tests nuevos)
- `supabase/functions/project-wizard-step/index.ts` (pasar clientCompany/decisionMaker, error codes)
- `src/hooks/useProjectWizard.ts` (propagar campos, hard-fail prereqs)
- Nueva migración: añadir `client_company` y `decision_maker_name` a `business_projects` + backfill AFFLUX.
- (Opcional menor) UI para editar empresa cliente / decisor antes de generar propuesta.
