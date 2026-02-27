

## Plan: Solucionar timeout del PRD (Fase 7)

### Diagnóstico

El error `"Failed to send a request to the Edge Function"` no es un bug de código — es un **timeout**. La función Edge arranca correctamente (los logs muestran `booted`), pero la llamada a Claude con el prompt largo del PRD excede el límite de tiempo de Supabase Edge Functions (~60s). Los logs no muestran ningún error de ejecución porque la función simplemente muere antes de completar.

### Solución

Reducir la carga del prompt de PRD y/o usar el modelo más rápido. Dos cambios:

1. **`supabase/functions/project-wizard-step/index.ts`**:
   - **Truncar inputs largos** antes de enviarlos al LLM. Los strings `finalStr`, `aiLevStr`, `briefStr` se pasan completos y pueden ser enormes. Añadir un helper `truncate(str, maxChars)` que limite cada input a ~15.000 caracteres, priorizando el principio del documento.
   - **Reducir `max_tokens` de Claude para PRD** de 16384 → 8192. Un PRD completo cabe en ~6K tokens output. Esto acelera la generación.

2. **Alternativa más robusta**: Cambiar el modelo del PRD de `claude` a `flash` (Gemini 2.5 Flash), que es significativamente más rápido y maneja bien generación de Markdown largo. Esto se configura en `STEP_ACTION_MAP` línea 456.

### Cambios concretos

**Opción A (recomendada — mínimo cambio):**
- Añadir función `truncate(s: string, max = 15000)` al edge function
- Aplicar truncado a `briefStr`, `scopeStr`, `auditStr`, `finalStr`, `aiLevStr`, `prdStr` antes de construir prompts
- Reducir `max_tokens` de 16384 a 8192 en `callClaudeSonnet`

**Opción B (más fiable):**
- Cambiar modelo del PRD en `STEP_ACTION_MAP`: `generate_prd` → `model: "flash"` en vez de `"claude"`
- Gemini Flash completa en ~15-20s vs Claude ~60-90s

### Archivos
- `supabase/functions/project-wizard-step/index.ts`
- Redeploy tras cambio

### Nota
Ambas opciones son compatibles. Recomiendo aplicar las dos: truncar inputs + usar Flash para PRD. Si la calidad del PRD con Flash no es suficiente, se puede revertir a Claude con los inputs truncados.

