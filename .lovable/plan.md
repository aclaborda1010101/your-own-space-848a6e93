

# Fix: Propuesta Cliente filtra datos internos y simplifica contenido

## Problema raiz

El pipeline de sanitizacion (lineas 1464-1529) solo procesa `typeof processedContent === "string"`. Cuando `stepNumber === 100`, el contenido es un **objeto JSON** que pasa directamente al renderer sin ninguna limpieza. Esto causa que:

1. Los campos `scope` y `techSummary` (strings dentro del objeto) conservan `[[INTERNAL_ONLY]]`, `[[PENDING:*]]`, `[HIPOTESIS]`, changelogs, menciones a Lovable, nombres de modelos IA, y citas textuales del briefing
2. `aiOpportunities` se vuelca como JSON crudo cuando no tiene estructura `opportunities[]`
3. `simplifyPrd()` en el frontend no filtra suficientes patrones (no elimina code blocks genericos, ni secciones RLS, ni catalogo de variables, ni interfaces TypeScript)
4. El budget muestra `hourly_rate_eur` y `total_hours` en la seccion de inversion
5. El scope se renderiza DOS veces (Resumen Ejecutivo + Alcance) causando duplicacion

## Cambios

### 1. Edge Function — `supabase/functions/generate-document/index.ts`

**Crear funcion `sanitizeTextForClient()`** que aplique el pipeline completo a un string individual:
- `autocloseInternalOnly` + `stripInternalOnly`
- `stripChangelog`
- `stripNoAplica`
- `processPendingTags` (client mode)
- `processNeedsClarification` (client mode)
- `translateForClient`
- Strip `[HIPOTESIS]` / `[HIPÓTESIS]` tags
- Strip menciones a "Lovable" y "Lovable.dev"
- Generalizar nombres de modelos IA (Claude, Anthropic, Haiku, Sonnet, Gemini, OpenAI → "Motor de IA")

**En el bloque `stepNumber === 100` (linea 1534+):**
- Aplicar `sanitizeTextForClient()` a `proposal.scope` y `proposal.techSummary` antes de renderizar
- Aplicar sanitizacion a cada `opp.description` en aiOpportunities
- Filtrar claves internas de `aiOpportunities` (`_score`, `parse_error`, `raw_response`, etc.)
- No renderizar `hourly_rate_eur` ni `total_hours` en la seccion de inversion
- Evitar duplicar el scope: el Resumen Ejecutivo extrae solo los primeros parrafos, y el Alcance renderiza el scope COMPLETO sin repetir el inicio. O mejor: Resumen Ejecutivo como seccion corta (max 5 lineas) y Alcance como seccion completa.
- Anadir seccion "Proximos Pasos" al final con CTA estandar

### 2. Frontend — `src/components/projects/wizard/ProjectProposalExport.tsx`

**Mejorar `simplifyPrd()`** para filtrar mas patrones:
- Anadir: `/RLS/i`, `/Row.Level.Security/i`, `/hook/i`, `/useState|useEffect/i`, `/PostgreSQL/i`, `/trigger/i`, `/schema/i`, `/Mermaid/i`, `/catálogo.*variables/i`, `/interface\s+\w+/i`, `/TypeScript/i`, `/Deno/i`, `/LOVABLE/i`, `/Blueprint/i`
- Filtrar TODOS los code blocks (` ```cualquierlenguaje `) no solo SQL
- Strip `[[INTERNAL_ONLY]]...[[/INTERNAL_ONLY]]` blocks antes de enviar
- Strip `[HIPOTESIS]` tags

**Filtrar campos internos del budget:**
- Eliminar `hourly_rate_eur` del objeto `development` ademas de `your_cost_eur` y `margin_pct`
- Eliminar `total_hours` (el cliente ve semanas, no horas de trabajo)

**Limpiar `aiOpportunities`** antes de enviar:
- Si es objeto, eliminar claves que empiecen con `_`, y `parse_error`, `raw_response`

### Ficheros

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | Nueva `sanitizeTextForClient()` + aplicar a scope/techSummary/aiOpportunities en step 100 + ocultar hourly_rate/total_hours + evitar duplicacion scope + generalizar modelos IA + strip Lovable + strip HIPOTESIS |
| `src/components/projects/wizard/ProjectProposalExport.tsx` | Ampliar `simplifyPrd` con mas patrones + filtrar todos code blocks + strip INTERNAL_ONLY + limpiar budget/aiOpportunities antes de enviar |

