

## Diagnóstico: Error en Step 4 (Auditoría Cruzada)

Dos fallos en cascada:

1. **Claude API key inválida** — `401: invalid x-api-key`. La clave de Anthropic almacenada en Supabase Secrets está expirada o mal configurada.
2. **Gemini Pro fallback falla** — modelo `gemini-3.1-pro` no existe (404). El nombre correcto del modelo actual de Google es `gemini-2.5-pro` (o `gemini-2.5-flash`).

### Fix 1: Actualizar ANTHROPIC_API_KEY

Ve a tu dashboard de Supabase → Edge Function Secrets y actualiza `ANTHROPIC_API_KEY` con una clave válida de Anthropic.

### Fix 2: Corregir nombre del modelo Gemini Pro

En `supabase/functions/project-wizard-step/index.ts` y `supabase/functions/_shared/ai-client.ts`, el modelo `gemini-3.1-pro` no existe. Hay que cambiarlo a `gemini-2.5-pro` (que sí es válido).

**Archivos a cambiar:**

| Archivo | Cambio |
|---|---|
| `supabase/functions/project-wizard-step/index.ts` | `gemini-3.1-pro` → `gemini-2.5-pro` en la URL de fetch (line 162) y en la variable de tracking (line 548) |
| `supabase/functions/_shared/ai-client.ts` | Aliases `gemini-pro` y `gemini-pro-3` → `gemini-2.5-pro` en vez de `gemini-3.1-pro` (lines 39-40) |

Con estos dos cambios, el fallback Gemini funcionará cuando Claude falle, y Step 4 se generará correctamente.

