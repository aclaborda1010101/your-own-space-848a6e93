

## 3 mejoras independientes

Atacamos los tres problemas que has descrito por separado, sin que se pisen.

---

### 1) Propuesta de AFFLUX se queda corta — falta profundidad real del proyecto

**Diagnóstico**

Tu PRD de AFFLUX en BD ocupa **166 KB** y el alcance interno **34 KB**, pero el "Documento de Alcance ≤15 págs" (step 102) que generaste hace una sola pasada con el LLM y le metemos como mucho 12 KB del alcance + 10 KB del PRD recortados. Resultado: el modelo solo "ve" la superficie y escribe 3-4 capas genéricas. Por eso te falta scraping inmobiliario, llamada comercial, detección temprana, seguimiento de oportunidades fuera de web, etc.

**Qué cambia**

Reescribimos el bloque step 102 con un pipeline en 3 pasadas (sin tocar el botón ni la UI):

1. **Pasada A — Inventario exhaustivo**: el LLM lee el PRD entero por trozos (chunks de ~25 KB con solapamiento) y devuelve un listado plano de TODOS los módulos/funcionalidades que detecta, con su descripción de negocio. Sin filtros. Objetivo: 40-80 ítems, no 15.
2. **Pasada B — Agrupación en capas**: con el inventario completo, una segunda llamada lo organiza en **5-8 capas funcionales** (en AFFLUX serían: Captación de oportunidades, Scraping y monitorización externa, Llamada y conversación comercial, Cualificación e inteligencia, Seguimiento y nurturing, Operación interna, Integraciones, Reporting). Asigna complejidad a cada tarea.
3. **Pasada C — Stack IA + costes**: igual que ahora, pero alimentada con el inventario ya agrupado.

**Lo que verás en el PDF**

- Capas reales del proyecto (no 3 genéricas).
- 30-50 tareas visibles agrupadas, no 15.
- Cada tarea con badge de complejidad y descripción comercial.
- Sigue cabiendo en ≤15 págs porque cada tarea son 1-2 líneas.

**Archivos**: `supabase/functions/generate-document/index.ts` (solo el bloque `stepNumber === 102`).

---

### 2) JARVIS no entiende nombres de contactos aproximados ("Iva", "Adri Panda", "Steve")

**Diagnóstico**

Verificado en el código: ni `jarvis-realtime` (el que usa el botón de voz) ni `jarvis-gateway` consultan nunca la tabla `people_contacts`. El RAG context que se le inyecta a Claude solo trae perfil, check-ins, tareas y eventos. El LLM no tiene de dónde sacar que "Iva" = "Iva Abouk". Por eso se queda pillado.

**Qué cambia**

Añadimos **resolución difusa de contactos** en `jarvis-realtime/index.ts` (y reutilizable en gateway):

1. Antes de llamar a Claude, detectamos en el transcript posibles **nombres propios** (palabras capitalizadas o tras patrones tipo "con/de/a/sobre X", "qué dije a X", "hablé con X").
2. Para cada candidato hacemos una **búsqueda fuzzy** contra `people_contacts` del usuario:
   - Match exacto sin tildes/case → top.
   - Substring (Iva ⊂ "Iva Abouk" o "Iva Book").
   - Distancia de Levenshtein ≤ 2 sobre cada palabra del nombre del contacto (Adri ↔ Adri Panda, Steve ↔ Steven).
   - Iniciales / apodos almacenados (si existen en `nicknames` o `aliases`).
3. Devolvemos los 1-3 contactos más probables con **score**. Si el score top supera un umbral, los inyectamos en el system prompt como bloque:

   ```
   📇 CONTACTOS MENCIONADOS (resolución automática):
   - "Iva" → Iva Abouk (score 0.92) | última interacción: ...
     * Últimos 3 mensajes resumidos: ...
   ```

4. Con eso, Claude responde directamente sobre el contacto sin pedir el nombre exacto.
5. Si hay **ambigüedad** (dos candidatos con score parecido), instruimos al prompt a preguntar: *"¿Te refieres a Iva Abouk o a Iva Book?"* — en lugar de quedarse bloqueado.

**Archivos**: `supabase/functions/jarvis-realtime/index.ts` (nueva función `resolveContacts()` + integración en el system prompt). Misma función portada a `jarvis-gateway/index.ts` cuando se detecte intención conversacional sobre contactos.

**Sin cambios** en BD ni en la UI.

---

### 3) JARVIS Real-Time se queda "desautorizado" al recibir una notificación

**Diagnóstico**

Cuando entra una push o cambias de app, el navegador suspende la pestaña; al volver, el `access_token` puede haber caducado. `useJarvisRealtimeVoice` llama a `supabase.functions.invoke('jarvis-realtime')`, que adjunta el JWT actual del cliente — si ha caducado y no se ha refrescado, la edge devuelve 401 y el componente se queda en estado `error`. Hoy no hay reintento automático ni refresh forzado.

**Qué cambia**

En `src/hooks/useJarvisRealtimeVoice.tsx` (`processWithClaude`):

1. **Refresh defensivo previo**: antes de cada `functions.invoke`, comprobamos `expires_at` de la sesión. Si quedan < 60 s, llamamos `supabase.auth.refreshSession()` y esperamos.
2. **Reintento con re-auth**: si la invoke devuelve 401/`Unauthorized` o `JWT expired`, forzamos `refreshSession()` y reintentamos UNA vez. Si sigue fallando, mostramos toast claro "Sesión renovada, intenta de nuevo" y dejamos el estado en `idle` (no `error`) para que el botón siga usable sin recargar la app.
3. **Listener `visibilitychange`**: cuando la pestaña vuelve a foreground, verificamos sesión y refrescamos preventivamente. Así, después de una notificación, el siguiente click ya está autenticado.
4. **Limpieza de estado bloqueado**: si `isProcessingRef` quedó `true` por un fallo silencioso, lo reseteamos al volver a foreground.

**Archivos**: `src/hooks/useJarvisRealtimeVoice.tsx` (sin tocar UI ni edge function).

---

### Orden de ejecución

1. Mejora propuesta AFFLUX (edge function only).
2. Resolución difusa de contactos (edge function only).
3. Resiliencia auth real-time (frontend hook only).

Sin migraciones, sin tablas nuevas, sin tocar componentes visuales. Cada cambio es independiente.

