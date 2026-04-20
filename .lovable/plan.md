
Objetivo: dejar funcionando ya la transcripción y la voz en tiempo real dentro de JARVIS, sin perder tiempo en hipótesis equivocadas.

Diagnóstico que he encontrado en el código:
- `supabase/functions/speech-to-text/index.ts` exige JWT con `validateAuth()` y devuelve `401 Unauthorized` si no llega `Authorization`.
- `src/hooks/useVoiceRecognition.tsx` invoca `speech-to-text` sin pasar headers explícitos; en este flujo de chat eso está llegando sin JWT.
- `src/hooks/useJarvisRealtime.tsx` también invoca `jarvis-voice` sin pasar el JWT explícitamente.
- `speech-to-text` y `jarvis-voice` no aparecen en `supabase/config.toml`, así que su comportamiento de verificación JWT queda inconsistente con el resto del proyecto.
- Hay un segundo bug claro en tiempo real: el hook usa `gpt-4o-realtime-preview-2024-12-17`, pero `supabase/functions/jarvis-voice/index.ts` crea la sesión con `gpt-4o-realtime-preview-2024-10-01`. Esa desalineación puede romper el flujo de sesión/SDP aunque el micrófono funcione.

Plan de implementación:
1. Arreglar la autenticación de STT
   - En `src/hooks/useVoiceRecognition.tsx`, obtener la sesión activa y enviar `Authorization: Bearer <token>` explícitamente al invocar `speech-to-text`.
   - Si no hay sesión válida, devolver error claro al usuario en vez de lanzar una llamada que acaba en 401.

2. Arreglar la autenticación de voz en tiempo real
   - En `src/hooks/useJarvisRealtime.tsx`, pasar también el JWT explícitamente al invocar `jarvis-voice`.
   - En `supabase/functions/jarvis-voice/index.ts`, añadir validación de auth en código para que el token efímero quede ligado a usuario autenticado y el comportamiento sea consistente.

3. Hacer explícita la config de las Edge Functions
   - Añadir `speech-to-text` y `jarvis-voice` a `supabase/config.toml`.
   - Revisar también `jarvis-stt` para no dejar funciones de voz fuera de la configuración declarada.

4. Corregir el bug del modelo realtime
   - Unificar el identificador del modelo en cliente y edge function.
   - Dejar un único source of truth para no volver a romperlo en otra iteración.

5. Endurecer el flujo
   - Ampliar `Access-Control-Allow-Headers` en las funciones de voz con los headers reales que usa Supabase web.
   - Mejorar logs y mensajes para distinguir: falta de sesión, permiso de micro denegado, fallo de STT, fallo de sesión realtime, fallo WebRTC.

6. Validación al implementar
   - Probar en `/chat` la transcripción normal: grabar, transcribir y enviar.
   - Probar el modo en vivo completo: token efímero, micrófono, SDP exchange y audio de respuesta.
   - Verificar móvil/iPad y desktop, porque ahora el problema principal está justo en ese flujo.

Archivos a tocar:
- `src/hooks/useVoiceRecognition.tsx`
- `src/hooks/useJarvisRealtime.tsx`
- `supabase/functions/speech-to-text/index.ts`
- `supabase/functions/jarvis-voice/index.ts`
- `supabase/config.toml`

Resultado esperado:
- La transcripción deja de devolver 401.
- La voz en tiempo real deja de fallar por auth/config/model mismatch.
- El chat de JARVIS vuelve a funcionar con micrófono y modo en vivo de forma consistente.
