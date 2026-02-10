

## Plan: Limpiar referencias Lovable AI y configurar APIs nativas

### Resumen
Eliminar todas las referencias a Lovable AI Gateway del codigo y configurar las API keys nativas (Google AI / Anthropic / OpenAI) como secretos de Supabase para que las edge functions funcionen correctamente.

### Paso 1: Limpiar `ai-client.ts`
Eliminar completamente la funcion `chatWithLovable` (lineas 214-259) y todas las constantes relacionadas (`LOVABLE_MODEL_ALIASES`, `DEFAULT_LOVABLE_MODEL`, `LOVABLE_API_KEY`). El flujo quedara:
- Si existe `OPENAI_API_KEY` -> usar OpenAI GPT-4
- Si existe `ANTHROPIC_API_KEY` -> usar Claude Sonnet
- Si existe `GOOGLE_AI_API_KEY` -> usar Google Gemini (nuevo, se anadira soporte)
- Si no hay ninguna -> error claro

### Paso 2: Anadir soporte para Google Gemini en `ai-client.ts`
Agregar una funcion `chatWithGemini` que llame directamente a `https://generativelanguage.googleapis.com/v1beta/models/` usando `GOOGLE_AI_API_KEY`. Esto cubrira los casos donde las edge functions usan `model: "gemini-flash"`.

### Paso 3: Configurar secretos en Supabase
Anadir los API keys necesarios como secretos del proyecto:
- `GOOGLE_AI_API_KEY` - para Gemini (usado por la mayoria de edge functions)
- `ANTHROPIC_API_KEY` - para Claude (ya referenciado en claude-client.ts)
- `OPENAI_API_KEY` - opcional, para GPT-4

Se pedira al usuario que proporcione al menos uno de estos keys.

### Paso 4: Actualizar model aliases
Mapear los alias existentes (`gemini-flash`, `gemini-pro`) a modelos reales de Google (`gemini-2.0-flash`, `gemini-1.5-pro`) en lugar de los prefijos `google/` del gateway.

### Detalles tecnicos

**Archivos a modificar:**
- `supabase/functions/_shared/ai-client.ts` - Eliminar Lovable gateway, anadir Gemini nativo
- `supabase/functions/_shared/claude-client.ts` - Sin cambios (ya usa API nativa)

**Prioridad de providers:**
```text
1. GOOGLE_AI_API_KEY  -> Google Gemini (default para la mayoria de funciones)
2. OPENAI_API_KEY     -> OpenAI GPT-4
3. ANTHROPIC_API_KEY  -> Claude Sonnet
```

**Nuevo modelo de seleccion:**
- `"gemini-flash"` -> `gemini-2.0-flash` (API directa de Google)
- `"gemini-pro"` -> `gemini-1.5-pro`
- Sin modelo especificado -> usa el primer provider disponible
- Las edge functions existentes que pasan `model: "gemini-flash"` funcionaran automaticamente

