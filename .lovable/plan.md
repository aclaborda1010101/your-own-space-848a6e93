

## Lanzar backfill completo de JARVIS para tu usuario

Vamos a forzar la indexación inmediata de **todas tus fuentes** en el knowledge graph de JARVIS, sin esperar al cron de 5 minutos.

---

### Qué voy a hacer

**1. Añadir botón "Reindexar todo" en Settings → JARVIS aprendió**

Un botón que dispare el backfill completo desde la UI (queda permanente para futuros reindex). Llama a `jarvis-history-ingest` en modo `backfill` para cada una de las 6 fuentes en paralelo:

- `whatsapp` — mensajes de WhatsApp
- `email` — emails cacheados
- `transcription` — transcripciones de voz
- `plaud` — grabaciones Plaud
- `project` — pasos del wizard (PRD, alcance, briefing, auditoría)
- `contact_note` — contexto/notas de contactos

Ventana: **365 días hacia atrás** (en vez de los 90 del cron) para capturar todo el histórico relevante.

**2. Lanzarlo inmediatamente para tu user_id**

En la misma sesión, ejecuto el backfill directamente vía edge function (`supabase--curl_edge_functions`) para que JARVIS tenga el contexto completo en cuanto termine de procesar (unos minutos según volumen).

**3. Mostrar progreso**

El botón muestra estado (procesando / completado / errores por fuente) usando los contadores que ya devuelve `jarvis-history-ingest`.

---

### Detalles técnicos

- **Archivo nuevo**: `src/components/settings/JarvisReindexCard.tsx` — botón + estado por fuente.
- **Settings.tsx**: añadir sección "Reindexar conocimiento JARVIS" (icono `RefreshCw`).
- **Sin cambios de schema, sin migraciones, sin tocar edge functions** (ya están preparadas tras la ronda anterior).
- **Concurrencia**: las 6 fuentes se lanzan en paralelo desde el cliente con `Promise.allSettled` para que un fallo en una no bloquee las demás.
- **Idempotencia**: `jarvis-history-ingest` ya deduplica por `source_id`, así que reejecutar es seguro.

---

### Resultado esperado

- En **2-5 minutos** JARVIS podrá responder a preguntas como:
  - "¿Cuál fue el último contacto de AFFLUX?"
  - "¿Qué dudas planteó el cliente en la última reunión?"
  - "Resúmeme el correo de [contacto] sobre AFFLUX"
- El botón queda disponible en Settings para futuros reindex manuales (tras importar nuevos datos, por ejemplo).

