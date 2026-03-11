

# Cambiar fallback de Gemini 3.1 Pro a Claude Sonnet 4

## Problema
Actualmente, cuando `gemini-3.1-pro-preview` recibe un 429 (rate limit), el fallback es `gemini-2.5-flash`. El usuario quiere que el fallback sea directamente a `claude-sonnet-4` (la función `callClaudeSonnet` ya existe y usa `claude-sonnet-4-20250514`).

## Cambios en `supabase/functions/project-wizard-step/index.ts`

### 1. `callGeminiPro` (líneas 157-199)
- Eliminar el array `models` con `gemini-2.5-flash`
- Intentar solo `gemini-3.1-pro-preview`
- Si falla con 429, hacer fallback a `callClaudeSonnet` en lugar de a Flash

### 2. `callPrdModel` (líneas 1009-1061)
- Eliminar `geminiModels` array con `gemini-2.5-flash`
- Intentar solo `gemini-3.1-pro-preview`
- Si falla con 429, caer directamente a `callClaudeSonnet` (ya lo hace como último recurso, pero ahora sin pasar por Flash)

### 3. Redeploy
- Desplegar la Edge Function actualizada

