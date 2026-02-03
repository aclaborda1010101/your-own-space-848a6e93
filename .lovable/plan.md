
## Objetivo
Corregir el fallo de voz “Realtime”: el usuario habla, la barra pasa a “JARVIS está pensando…” y después aparece “Error de conexión” y la sesión se corta.

## Lo que he observado en el código (puntos clave)
### 1) La conexión WebRTC se cierra demasiado agresivamente
En `src/hooks/useJarvisRealtime.tsx`:
- `pc.onconnectionstatechange` hace `cleanupOnError()` cuando `connectionState` es **'failed' o 'disconnected'**.
- En móviles (iOS/Safari/PWA) **'disconnected' puede ser transitorio** (cambios de red, ahorro de energía, jitter de ICE) y no significa “fin de sesión”.
- Resultado: aunque la llamada pudiera recuperarse, el hook la mata y el usuario ve el error.

### 2) Falta robustez/compatibilidad en el “SDP exchange”
Ahora mismo se hace:
- Token efímero: `supabase.functions.invoke('jarvis-voice')` (esto funciona; hay logs “Session created successfully”).
- SDP exchange: `fetch('https://api.openai.com/v1/realtime/calls', { Content-Type: 'application/sdp', Authorization: Bearer ek_... })`

En documentación y ejemplos recientes se ve con frecuencia:
- `.../v1/realtime/calls?model=...`
- añadir `Accept: application/sdp`
Esto mejora compatibilidad y evita respuestas inesperadas.

### 3) La UI muestra “pensando” al parar de hablar, pero si no llega respuesta queda “colgada”
Cuando llega `input_audio_buffer.speech_stopped` ponemos estado `processing` (“pensando…”).
Si por cualquier motivo el servidor no emite respuesta (o el cliente no la procesa), el usuario se queda en “pensando…”, y después el WebRTC puede entrar en ‘disconnected’ y el código lo cierra.

## Hipótesis más probable
Una combinación de:
1) Estado `disconnected` transitorio → el cliente cierra la conexión de inmediato → “Error de conexión”.
2) SDP exchange sin `?model=` y sin `Accept` → en algunos entornos puede degradar o provocar cierres tempranos.
3) Falta de “watchdog”/recuperación (ICE restart, reintentos) → cualquier microcorte rompe la sesión.

## Cambios propuestos (implementación)
### A) Hacer el manejo de “disconnected” tolerante (sin cortar la sesión inmediatamente)
En `useJarvisRealtime.tsx`:
1. Cambiar la lógica de `pc.onconnectionstatechange`:
   - Cerrar inmediatamente solo en **'failed'** o **'closed'**.
   - Para **'disconnected'**, iniciar un temporizador (p.ej. 5–10s):
     - Si vuelve a **'connected'** antes del timeout, cancelar el cierre.
     - Si permanece desconectado tras el timeout, entonces sí: toast + cleanup.
2. Intentar **recuperación** antes de rendirse:
   - Si `disconnected`, hacer `pc.restartIce()` (una sola vez por sesión) y esperar.
3. Añadir logs/diagnóstico mínimo:
   - Guardar en estado “lastConnectionError” (string) el motivo real (estado, ICE state, etc.) para mostrarlo en toast o consola.

### B) Endurecer el SDP exchange contra variaciones de API
En `startSession()`:
1. Usar el modelo devuelto por el servidor (o el mismo hardcoded) y llamar:
   - `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`
2. Añadir header:
   - `Accept: application/sdp`
3. Usar `offer.sdp` (o verificar que `pc.localDescription?.sdp` no sea `undefined` y si lo es, lanzar error explícito).
4. Si el SDP exchange devuelve error, incluir `status + body` en el mensaje de error para no ver solo “Error de conexión”.

### C) Mejorar el ciclo de conversación para evitar quedarse “pensando”
Sin romper lo que ya funciona:
1. Implementar un “watchdog” tras `speech_stopped`:
   - Si en X ms (p.ej. 800–1200ms) no se recibe ningún evento de respuesta (`response.*`), enviar manualmente `sendEvent({ type: 'response.create' })`.
   - Esto reduce casos de “se queda pensando” por falta de disparo de respuesta.
2. Reset de UI más robusto:
   - En `response.done` ya se vuelve a `listening`. Mantener, pero también considerar volver a `listening` si el watchdog expira sin respuesta y no hay error.

### D) Manejo de errores del dataChannel más “accionable”
1. En `dc.onerror` y en eventos `type: 'error'` recibidos por data channel:
   - Mostrar toast con mensaje real si existe (`event.error.message`), no genérico.
2. Si `dc.onclose` ocurre inesperadamente:
   - Mostrar toast “Sesión finalizada” y hacer `cleanupOnError()` (pero diferenciando de `disconnected` temporal del peer connection).

### E) Proteger la UX cuando el usuario no está autenticado (porque ahora está en `/login`)
Esto no debería ser la causa primaria del WebRTC, pero sí evita confusión:
1. Antes de iniciar la sesión, comprobar `supabase.auth.getSession()`:
   - Si no hay sesión, mostrar “Inicie sesión para usar JARVIS” y no iniciar WebRTC.
2. Asegurar que, si el usuario es redirigido a `/login`, se llame a `stopSession()` para limpiar audio/RTC y no dejar estados inconsistentes.

## Archivos a tocar
- `src/hooks/useJarvisRealtime.tsx` (principal: WebRTC, SDP exchange, watchdog de respuesta, manejo de disconnected)
- (Opcional) `src/components/layout/AppLayout.tsx` o un hook global de auth para parar sesión si se pierde auth mientras está activo (si encaja mejor con la arquitectura actual)

## Plan de verificación (pasos de prueba)
1. Con usuario logueado, activar JARVIS:
   - Confirmar toast “JARVIS conectado” y que el estado pasa a `listening`.
2. Decir una frase simple (“hola JARVIS”) y comprobar:
   - No aparece “Error de conexión”
   - Pasa a “pensando…” y luego a “hablando…”
3. Repetir 5 veces con pausas y cambios de red típicos (wifi/datos si se puede):
   - Verificar que un `disconnected` corto no mata la sesión.
4. Probar una orden que llame a funciones (crear tarea) para confirmar que la sesión no se cae al ejecutar tools.
5. Probar en iPhone (Safari/PWA) y en escritorio (Chrome) para comparar estabilidad.

## Riesgos / trade-offs
- Si el servidor ya auto-genera respuestas con VAD, el “watchdog + response.create” podría duplicar respuestas. Por eso el watchdog debe:
  - activarse solo si no llega ningún evento de respuesta en ~1s.
- `restartIce()` no siempre ayuda en redes restrictivas, pero al menos evita cierres falsos.

## Resultado esperado
- La sesión deja de cortarse justo después de “JARVIS está pensando…”.
- Los fallos reales se ven con mensajes más claros (código/razón), y los microcortes no rompen la llamada.
- Mejor comportamiento en iOS/Safari/PWA.
