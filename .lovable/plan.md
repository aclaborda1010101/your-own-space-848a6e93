

## Plan: Fallback a Gemini Pro para generación de alcance

### Cambio en `supabase/functions/project-wizard-step/index.ts`

1. **Añadir función `callGeminiPro`** (tras `callClaudeSonnet`, ~línea 114):
   - Modelo: `gemini-2.5-pro` (gemini-3.1-pro no existe aún en la API pública; `gemini-2.5-pro` es el tier más alto disponible)
   - `temperature: 0.4`, `maxOutputTokens: 16384`
   - Usa `GEMINI_API_KEY` ya configurada
   - Retorna `{ text, tokensInput, tokensOutput }`

2. **Wrap `generate_scope` con try-catch + fallback** (~línea 351):
   - Intentar `callClaudeSonnet` primero
   - Si falla (cualquier error: 400, 402, 429, límites), hacer fallback a `callGeminiPro` con los mismos prompts
   - Ajustar cálculo de coste según modelo usado (Gemini Pro: $1.25/M input, $10/M output)
   - Registrar en `project_costs` el servicio real usado (`"gemini-pro"` o `"claude-sonnet"`)
   - Añadir campo `modelUsed` y `fallbackUsed` en la respuesta JSON

3. **Redesplegar** la edge function

### Archivos
- `supabase/functions/project-wizard-step/index.ts`

