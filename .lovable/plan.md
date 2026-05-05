Diagnóstico: el error viene de `supabase/functions/daily-briefing/index.ts`. Esa función todavía llama a Anthropic/Claude (`claude-sonnet-4-20250514`) y en logs está fallando con `Your credit balance is too low to access the Anthropic API`. Por eso ves “Error cargando el briefing matutino” y la sensación de “modelo viejo”.

Plan de corrección:

1. Migrar `daily-briefing` a Lovable AI Gateway
   - Sustituir `ANTHROPIC_API_KEY` y `https://api.anthropic.com/v1/messages` por `LOVABLE_API_KEY` y `https://ai.gateway.lovable.dev/v1/chat/completions`.
   - Usar Gemini conforme a la memoria del proyecto:
     - `google/gemini-3-flash-preview` para briefing normal.
     - Mantener estructura preparada para `google/gemini-3.1-pro-preview` si se quiere elevar calidad después.
   - Pedir `response_format: { type: "json_object" }` para reducir fallos de parseo.
   - Cambiar logs y errores de “Claude” a “Lovable AI Gateway/Gemini”.

2. Mejorar resiliencia del briefing
   - Si el gateway devuelve error, responder con mensaje claro en JSON y no con error genérico opaco.
   - Añadir fallback local mínimo para que la tarjeta no quede vacía si la IA falla temporalmente.
   - Mantener caché por día/tipo en `daily_briefings`, pero permitir regeneración real cuando el usuario pulsa refrescar.

3. Corregir integración frontend
   - En `MorningBriefingCard.tsx`, cuando el usuario pulse regenerar, enviar `force: true` a la función.
   - Mostrar el detalle del error devuelto por la función en el toast, no solo “Error cargando el briefing matutino”.
   - Normalizar arrays (`task_priorities`, `alerts`) para que no se impriman mal o desaparezcan.

4. Forzar preview nueva
   - Actualizar el `cache-bust` en `src/main.tsx` con un timestamp nuevo para que Lovable/Vite no conserve el bundle anterior.

5. Verificación posterior
   - Revisar logs de la función para confirmar que ya no aparece `Claude API error` ni `api.anthropic.com`.
   - Confirmar que el briefing responde con `success: true` y contenido de Gemini.