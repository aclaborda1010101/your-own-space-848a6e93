

# Fix: Resumen Ejecutivo — Numeración duplicada, costes recurrentes y plazos

## Problemas

1. **Numeración duplicada en TOC**: `renumberScope()` inserta "2.1.", "2.2." en los headings del markdown. Luego `buildTocHtml()` extrae esos headings del HTML resultante y vuelve a anteponer "2.1.", "2.2." — resultado: "2.1. 2.1. Título".

2. **Costes recurrentes duplicados**: La sección "Costes Recurrentes Mensuales" (líneas 1929-1943) aparece dentro del alcance Y luego de nuevo en el presupuesto. El usuario quiere eliminarla completamente de la sección 2 (alcance) ya que ya aparece en la sección de Presupuesto.

3. **Plazos incongruentes**: El scope describe duraciones largas ("8 semanas", "6 semanas") que vienen del documento original, pero el Gantt usa las fases del budget que tienen duraciones distintas. No hay sincronización entre ambos.

## Cambios en `supabase/functions/generate-document/index.ts`

### Fix 1: Eliminar numeración duplicada

**Problema**: `renumberScope()` numera los headings en el markdown ("## 2.1. Título") → `markdownToHtml` lo convierte a `<h2>2.1. Título</h2>` → `extractHeadings` lo lee → `buildTocHtml` le antepone "2.1." otra vez.

**Solución**: Eliminar la función `renumberScope()`. En su lugar, dejar los headings del scope SIN números. `buildTocHtml()` ya se encarga de la numeración automática en el TOC. Para que los headings dentro del cuerpo del documento también lleven número, inyectar los números directamente en el HTML final tras `markdownToHtml`, o mejor: hacer que `buildTocHtml` no duplique lo que ya existe.

Enfoque elegido: **Quitar `renumberScope`** y en su lugar, antes de `markdownToHtml`, strip cualquier número existente de los `##` headings (ej: "## 5.1. Título" → "## Título"). `buildTocHtml()` añadirá la numeración correcta solo en el TOC. Si se quiere numeración en el body, se hará un post-procesado del HTML que numere los `<h2>` de forma correlativa.

### Fix 2: Eliminar sección de costes recurrentes del cuerpo

Eliminar las líneas 1929-1943 (bloque `if (proposal.budget?.recurring_monthly)`) de la sección de Presupuesto del step 101. Los costes recurrentes ya NO aparecerán en el resumen ejecutivo, ya que el presupuesto solo mostrará setup + mensualidad del modelo seleccionado.

### Fix 3: Sincronizar plazos del scope con budget

Antes de renderizar el scope, buscar en el texto patrones de duración (ej: "Fase 0 ... 6 semanas", "8 semanas") y reemplazarlos con las duraciones reales de las fases del budget. Esto se hará con un post-procesado del scope que:
- Para cada fase del budget, buscar su mención en el scope (por nombre o número de fase)
- Reemplazar la duración mencionada con `getPhaseWeeks(phase)` semanas

## Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | (1) Eliminar `renumberScope`, strip números de headings, post-procesar HTML para numerar body. (2) Eliminar bloque costes recurrentes. (3) Sincronizar duraciones scope↔budget. |

