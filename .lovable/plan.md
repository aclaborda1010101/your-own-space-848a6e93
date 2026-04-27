## Objetivo

Hoy la propuesta cliente (F7 / Step 30) tiene una sección "Plan de implementación" con un único campo `timeline` que **siempre** sale con el fallback genérico ("Plazos detallados a confirmar al cierre de la sesión de arranque…"), porque el mapper `budgetToCommercialTerms` nunca lo rellena. Resultado: el cliente no ve plazos reales en el PDF.

Vamos a sustituirlo por un **cronograma por fases derivado del scope (heurística determinista) con override manual** desde el panel de presupuesto.

---

## 1 · Heurística determinista (fuente por defecto)

Nueva función `deriveImplementationSchedule(scope)` en `f7-proposal-builder.ts` que produce un objeto:

```ts
interface ImplementationSchedule {
  phases: Array<{
    name: string;            // "Fase 1 — MVP", "Fase 2 — Fast-follow", "Fase 3 — Roadmap"
    duration_weeks: string;  // "8-10 semanas"
    start_week: number;      // 1, 11, ...
    end_week: number;
    component_count: number;
    key_milestones: string[];
    deliverable: string;
  }>;
  total_duration_weeks: string;
  mvp_ready_week: number;
  assumptions: string[];      // "Equipo dedicado…", "Disponibilidad cliente…"
}
```

**Reglas de cálculo** (sin LLM, reproducibles):
- **Arranque**: 2 semanas fijas (kickoff + sesiones Soul si aplica).
- **MVP**: `ceil(mvp_count × 1.2)` semanas, mínimo 6, máximo 16.
- **Fast-follow**: `ceil(ff_count × 1.0)` semanas, solo si `ff_count > 0`.
- **Roadmap**: solo se nombra como "fase posterior a confirmar", sin estimar semanas.
- **Cierre**: 1 semana de hardening + entrega.
- **Hitos clave por fase** derivados de `scope.compliance_blockers` (DPIA antes de producción), `soul_capture_plan` (sesiones en semanas X-Y), y los componentes principales del bucket.

## 2 · Override manual desde el panel de presupuesto

Ampliar `BudgetData` con un campo opcional `implementation_override` y exponerlo en `ProjectBudgetPanel.tsx`:

```ts
implementation_override?: {
  mvp_weeks?: number;          // sobrescribe duración MVP
  fast_follow_weeks?: number;  // sobrescribe duración F2
  start_date?: string;         // ISO, opcional, para mostrar fechas absolutas
  notes?: string;              // texto libre que se anexa al cronograma
}
```

UI nueva en `ProjectBudgetPanel`: bloque colapsable **"Plazos de implementación"** (visible solo en modo edición) con:
- 2 inputs numéricos (semanas MVP / semanas Fast-follow) con placeholder mostrando el valor heurístico.
- Date picker opcional para fecha de arranque.
- Textarea opcional para notas.
- Botón "Restaurar valores sugeridos" que vacía los overrides.

## 3 · Propagación al mapper

`budgetToCommercialTerms.ts` pasa el override (si existe) a `commercial_terms_v1.implementation_override`. `f7-proposal-builder` aplica la prioridad: **override manual > heurística > fallback genérico**.

## 4 · Render markdown (sección "Plan de implementación")

Sustituir las 3 líneas actuales por:

```markdown
## N. Plan de implementación

El proyecto se ejecuta en 3 fases con entregables verificables y cierre formal por fase.

**Cronograma estimado: 12-14 semanas. MVP operativo en semana 10.**

| Fase | Duración | Componentes | Hito principal |
|---|---|---|---|
| Fase 1 — MVP | Semanas 1-10 (8-10 sem) | 13 componentes | MVP operativo y validado |
| Fase 2 — Fast-follow | Semanas 11-13 (2-3 sem) | 2 componentes | Extensión funcional |
| Fase 3 — Roadmap posterior | A confirmar | — | Evolución continua |

**Sesiones Soul:** 3 sesiones de captura de criterio en semanas 1 y 2.

**Supuestos:**
- Equipo dedicado por nuestra parte durante todo el proyecto.
- Disponibilidad de stakeholders del cliente para validar entregables al cierre de cada fase.
- Acceso a sistemas y datos en plazos acordados.
```

Si hay `start_date`, se añaden fechas absolutas entre paréntesis (ej. *"Semanas 1-10 (15 may - 24 jul)"*).

## 5 · Tests (añadir a `f7-proposal-builder_test.ts`)

- `deriveImplementationSchedule` con scope MVP=13/F2=2 → MVP ≈ 10 sem, total ≈ 13 sem.
- Override manual gana sobre heurística.
- Render markdown contiene tabla con las 3 fases.
- `mvp_ready_week` aparece en negrita en la línea resumen.
- Sin Soul, no se renderiza la línea de Soul.
- Si `ff_count = 0`, omite la fila Fast-follow.
- `detectInternalJargon` sigue limpia tras añadir el cronograma.

## 6 · No se toca

- Step 28 (scope) — solo se lee.
- Step 29 (PRD) — no afectado.
- Step 32 (Build Pack) — no afectado.
- Generación PDF (`generate-document`) — sigue recibiendo `proposal_markdown` ya renderizado.
- Sanitizadores — los textos del cronograma son neutros, sin jerga.

## 7 · Archivos a modificar

1. `supabase/functions/project-wizard-step/f7-proposal-builder.ts` — `deriveImplementationSchedule`, nuevos tipos, render tabla, prioridad override.
2. `supabase/functions/project-wizard-step/f7-proposal-builder_test.ts` — 6 tests nuevos.
3. `src/lib/budgetToCommercialTerms.ts` — propagar `implementation_override` y tipo `BudgetData`.
4. `src/components/projects/wizard/ProjectBudgetPanel.tsx` — bloque UI "Plazos de implementación" en modo edición.
5. Deploy `project-wizard-step` y test edge functions.

## 8 · Validación post-deploy

Tras aprobar, el usuario debe:
1. Abrir el proyecto AFFLUX, ir al Paso 4 (Presupuesto), entrar en edición y opcionalmente ajustar plazos (o dejar valores sugeridos).
2. Aprobar presupuesto.
3. Regenerar propuesta cliente (Paso 5).
4. Descargar PDF y verificar la nueva tabla en "Plan de implementación".
