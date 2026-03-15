

## Diagnóstico

El briefing **se genera correctamente** en formato v3, pero el JSON se **trunca** porque `maxOutputTokens: 16384` es insuficiente para el esquema v3 con todos los metadatos por item (evidence_snippets, blocked_by, downstream_impact, etc.) sobre una transcripción tan larga.

Evidencia:
- `raw_text` tiene 20229 chars y termina en una `evidence_snippet` cortada a mitad de frase
- El backend no puede parsear el JSON truncado → lo guarda como `{ raw_text: "...", parse_error: true }`
- El frontend intenta re-parsear `raw_text` pero también falla porque el JSON está incompleto
- El validador reporta 8 violations porque ve los datos como `parse_error`, no como v3

## Plan de corrección

### 1. Aumentar `maxOutputTokens` en `callGeminiFlash`

**Archivo:** `supabase/functions/project-wizard-step/index.ts` (línea 67)

Cambiar `maxOutputTokens: 16384` → `maxOutputTokens: 65536` (Gemini 2.5 Flash soporta hasta 65k tokens de output).

### 2. Detectar truncamiento y reparar JSON

**Archivo:** `supabase/functions/project-wizard-step/index.ts` (líneas 680-703)

Después del parse fallido, antes de guardar como `parse_error`:
- Verificar `finishReason` de Gemini (si es `MAX_TOKENS` → truncamiento confirmado)
- Intentar cerrar el JSON truncado: contar `{`/`[` abiertos y cerrarlos
- Si sigue sin parsear, hacer una segunda llamada con "completa este JSON" como fallback

### 3. Optimizar el prompt para reducir output

**Archivo:** `supabase/functions/project-wizard-step/index.ts` (líneas 535-678)

Añadir instrucciones al prompt de extracción:
- Limitar `evidence_snippets` a máximo 2 por item, máximo 100 caracteres cada una
- Limitar arrays `blocked_by` y `downstream_impact` a máximo 3 items
- Máximo 15 `observed_facts`, 10 `inferred_needs`, 8 `solution_candidates`

### 4. Propagar `finishReason` desde la API de Gemini

**Archivo:** `supabase/functions/project-wizard-step/index.ts` (línea 81)

Leer `data.candidates?.[0]?.finishReason` y loguearlo. Si es `MAX_TOKENS`, lanzar un retry automático con token limit más alto o prompt más restrictivo.

### Archivos a modificar

- `supabase/functions/project-wizard-step/index.ts` — 4 cambios puntuales en las zonas indicadas

