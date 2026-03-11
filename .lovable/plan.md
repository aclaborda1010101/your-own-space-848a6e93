

# Fix: Resumen Ejecutivo (Step 101) — Correcciones PDF

## Problemas identificados

1. **Índice sin numerar** — El TOC (`buildTocHtml`) solo lista texto sin números. Los headings del scope llegan con numeración original del documento fuente (ej: "5.1", "5.2") en vez de renumerarse.
2. **Costes recurrentes incongruentes** — El step 101 renderer muestra `recurring_monthly.total_monthly_eur` como resumen genérico, pero no usa los `items[]` reales del budget. Los valores no coinciden con lo definido en el panel de presupuesto.
3. **Comparativa con alternativas** — Se renderiza contenido innecesario (probablemente viene dentro del scope o de los modelos de monetización con pros/cons). Hay que eliminar cualquier sección de "comparativa".
4. **Incongruencia timeline vs scope** — El scope dice "8 semanas Fase 1" pero el Gantt calcula `hours/40` dando valores distintos. Debe usar las duraciones del scope si existen, o al menos ser coherente con las fases del budget.
5. **"Inversión" → "Presupuesto"** — Renombrar la sección.
6. **Contenido extra en modelos** — Los pros, cons, best_for, description larga, ROI, "recuperación rápida", "ingresos recurrentes", "escalable" no deben aparecer. Solo: nombre del modelo + setup price + monthly price.
7. **Costes recurrentes de API inventados** — El renderer no pasa los `recurring_monthly.items[]` reales al PDF.

## Cambios

### 1. Edge Function — `supabase/functions/generate-document/index.ts`

**`buildTocHtml()`** (línea 1263): Añadir numeración automática. Mantener un contador para H1 (1, 2, 3...) y sub-contador para H2 (1.1, 1.2...).

**Step 101 renderer** (líneas 1790-1923):

- **Scope headings**: Renumerar headings del scope. Antes de `markdownToHtml()`, reemplazar cualquier patrón `## N.M` o `## N.M.` con numeración secuencial relativa al documento (empezando por la sección 2 ya que sección 1 es Resumen Ejecutivo).

- **Renombrar** `<h1>Inversión</h1>` → `<h1>Presupuesto</h1>`.

- **Simplificar modelos de monetización**: Solo renderizar nombre, setup_price_eur, monthly_price_eur. Eliminar: description, pros, cons, best_for, métricas extra, recommended badge.

- **Costes recurrentes**: Usar `recurring_monthly.items[]` reales en vez del total genérico. Renderizar tabla con nombre y coste de cada item, más el total.

- **Eliminar comparativa**: Si el scope contiene secciones tipo "Comparativa", "Alternativas", filtrarlas antes de renderizar.

- **Timeline coherente**: En el Gantt, si las fases del budget tienen un campo `weeks` o `duration_weeks`, usarlo directamente en vez de `hours/40`. Si no existe, seguir con `hours/40` pero asegurar que las fases del budget coincidan con lo que el scope describe.

### 2. Frontend — `src/components/projects/wizard/ProjectProposalExport.tsx`

Sin cambios significativos — los problemas están en el renderer del edge function.

## Ficheros

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | Numerar TOC, renumerar headings del scope, renombrar Inversión→Presupuesto, simplificar modelos (solo precios), usar items[] reales para recurrentes, filtrar secciones de comparativa, coherencia timeline |

