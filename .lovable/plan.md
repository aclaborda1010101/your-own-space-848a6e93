

## Plan: bandeja de inteligencia con memoria — no volver a sugerir lo ya aceptado/rechazado

### Causa raíz (verificada en BD)
- El índice `UNIQUE (user_id, signature) WHERE status='pending'` sólo deduplica entre **pendientes**. Una vez aceptas/rechazas, la firma "se libera" y el LLM la vuelve a meter.
- El prompt al LLM no recibe el historial de lo ya decidido, así que regenera lo mismo (a veces con título ligeramente distinto, otra firma).
- Ejemplo real ya en tu BD: "Verificar dominio con Google Search Console" para Álvaro → aceptada el 19/4 → reaparece pendiente el 20/4.

### Cambios

**1. Deduplicación dura por firma — sin importar status (`detect-task-signals/index.ts`)**
- Antes de insertar, consultar `suggestions` por `(user_id, signature)` con cualquier status. Si ya existe (accepted, rejected, snoozed o pending) → **skip silencioso**. Esto cierra el agujero del índice parcial.
- Mantener el índice parcial actual (sigue siendo útil para concurrencia), pero la lógica de negocio bloquea ya en aplicación.

**2. Inyectar memoria al LLM (mismo archivo)**
- Antes de llamar al LLM por contacto, cargar las últimas ~30 sugerencias **no-pending** de ese contacto (`status IN ('accepted','rejected','snoozed')`) con su título y status.
- Pasarlas al prompt en una sección "YA DECIDIDO — NO PROPONER":
  ```
  ACEPTADAS (no repitas, ya están como tarea):
  - Crear usuarios en Lexintel
  - Verificar dominio con Google Search Console
  RECHAZADAS (el usuario las descartó, NO las propongas otra vez):
  - Aclarar tema Inmogestión con Agustito
  - Ver a Alicia
  ```
- Añadir regla dura al prompt: "Si una sugerencia es semánticamente equivalente a algo en YA DECIDIDO, NO la incluyas. Equivalencia = mismo objetivo aunque cambien las palabras."

**3. Firma normalizada más robusta**
- Normalizar el título antes de hashear: minúsculas, sin tildes, sin números, colapsar espacios, quitar palabras de relleno ("crear", "hacer", "el", "la", "para"). Esto hace que "Crear 3 usuarios para Lexintel" y "Crear usuarios en Lexintel" produzcan la misma firma.

**4. UI — feedback visible (`useSignalSuggestions.tsx` + `IntelligenceInbox.tsx`)**
- Tras aceptar/rechazar, el item ya desaparece (correcto). Añadir contador en el escaneo: "Escaneo completado: N nuevas, M omitidas (ya las habías visto)". El backend ya devuelve `skipped`, sólo falta mostrarlo.

### Out of scope
- No tocamos el modelo LLM ni el threshold de 30 mensajes.
- No tocamos otras suggestions de Plaud (`useSuggestions`) — bug confinado a `detect-task-signals`.

### Archivos a tocar
- `supabase/functions/detect-task-signals/index.ts` — pre-check por firma (cualquier status), inyectar contexto histórico al LLM, normalizar firma.
- `src/hooks/useSignalSuggestions.tsx` — exponer `skipped` en el toast del escaneo.

### Resultado esperado
Pulsar "Escanear ahora" tras haber aceptado/rechazado tareas previas devolverá sólo señales **nuevas de verdad**. Ya no reaparecerá "Verificar dominio…" ni "Aclarar tema Inmogestión…".

