
Diagnóstico confirmado:
- Do I know what the issue is? Sí.
- El error ya no es por API key expirada: ahora es `404 NOT_FOUND` porque `models/gemini-2.0-flash` está deprecado/no disponible para usuarios nuevos.
- Evidencia: logs de `project-wizard-step` muestran exactamente `This model models/gemini-2.0-flash is no longer available to new users`.

Plan de implementación (directo y corto):
1. Actualizar `supabase/functions/project-wizard-step/index.ts`:
   - Cambiar el endpoint de extracción de:
     - `models/gemini-2.0-flash:generateContent`
     - a `models/gemini-2.5-flash:generateContent`.
   - Actualizar `model_used` guardado en DB a `gemini-2.5-flash`.
   - Mantener fallback de secret (`GEMINI_API_KEY || GOOGLE_AI_API_KEY`) como está.

2. Endurecer mensajes de error en la misma función:
   - Si Google responde `404` por modelo, devolver error claro tipo “modelo no disponible, requiere migración”.
   - Mantener respuesta JSON consistente para que frontend no muestre solo “non-2xx”.

3. Actualizar alias global para evitar próximos fallos similares:
   - En `supabase/functions/_shared/ai-client.ts` cambiar:
     - alias `gemini-flash` -> `gemini-2.5-flash`
     - `DEFAULT_GEMINI_MODEL` -> `gemini-2.5-flash`.
   - Esto evita que otras edge functions con `model: "gemini-flash"` sigan rompiendo con cuentas nuevas.

4. Desplegar funciones afectadas:
   - `project-wizard-step`
   - (si se aplica paso 3) funciones que dependan del `_shared/ai-client` según pipeline de deploy del proyecto.

5. Verificación:
   - Reintentar extracción en `/projects/wizard/b3ac852a-3b15-446a-84ae-4ff009e639a6`.
   - Confirmar que crea/actualiza `project_wizard_steps` con `step_number=2` y estado `review`.
   - Confirmar en logs que desaparece el `404 models/gemini-2.0-flash`.
   - Confirmar toast de éxito en UI (sin “Edge Function returned a non-2xx status code”).

Detalles técnicos (para implementación):
- Archivo principal del bug: `supabase/functions/project-wizard-step/index.ts` (línea del fetch a Gemini 2.0 Flash).
- Archivo de prevención global: `supabase/functions/_shared/ai-client.ts` (alias/modelo por defecto aún en 2.0 Flash).
- El secret `GEMINI_API_KEY` ya existe y está cargado; no hay que tocar secrets ahora.
