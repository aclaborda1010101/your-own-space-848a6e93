

# Auditoría JARVIS Memoria/RAG histórico

## Lo que YA existe (y funciona)
- **Tablas**: `jarvis_memory` (memoria estructurada), `specialist_knowledge` (RAG por especialista, **94 filas con embeddings**), `knowledge_embeddings` (629/639 con embedding, **dataset general OK**), `conversation_embeddings` (esquema listo + RPC `search_conversations` con pgvector + RPC `search_knowledge`).
- **RAGs verticales**: `rag_chunks`, `rag_sources`, `rag_knowledge_graph_nodes` (917) y `rag_knowledge_graph_edges` (6010) → infraestructura de Pattern Detector / Expert Forge. **Funciona, pero está aislada**: solo se usa para proyectos/clientes, no para la memoria personal de Agustín.
- **Pipeline de embeddings**: `rag-architect` genera embeddings con OpenAI `text-embedding-3-small` (1024 dims). Probado y operativo.
- **Datos en bruto enormes**: 705k mensajes de WhatsApp (`contact_messages`), 8.5k mensajes JARVIS, 934 transcripciones, 788 emails, 2573 contactos, 125 eventos de timeline.
- **Memoria conversacional**: `jarvis-realtime` inserta en `jarvis_memory` y `get_jarvis_context` la recupera ordenada por importance + recency.

## Lo que está ROTO o INFRAUTILIZADO (los huecos reales)

| Síntoma | Causa | Impacto |
|---|---|---|
| `conversation_embeddings` = **0 filas** | Solo `process-transcription` inserta, y el bloque está condicionado a un flujo que no se está ejecutando | JARVIS **no puede buscar histórico semántico** de transcripciones reales |
| `jarvis_memory` = **1 fila** (¡una!) | `jarvis-realtime` solo guarda al final de sesiones de voz; el chat de texto / WhatsApp / Telegram no escriben aquí | La "memoria" que pintamos en context es vacía |
| 705k mensajes de WhatsApp **sin embeddings ni clasificación** | `contact_messages` no tiene columna `embedding` ni se procesa nunca para retrieval | Cuando preguntas "qué me dijo Carlos en diciembre" → no hay forma de buscarlo semánticamente, solo LIKE |
| 788 emails (`jarvis_emails_cache`) **sin embeddings** | Igual: hay `body_text`, no hay vector | Igual problema con correo |
| Adjuntos de timeline (`business_project_timeline_attachments`) = 0 filas | El extractor de adjuntos no está pegado al pipeline | Ningún PDF/imagen pasa a memoria |
| `specialist_memory` = 18 filas | Solo `jarvis-gateway` inserta cuando detecta keywords ("quiero", "objetivo"…). Heurística pobre | Memoria semántica vacía por especialista |
| Knowledge graph personal: **no existe** | Solo hay graph de RAGs verticales (proyectos). No hay grafo Persona ↔ Tema ↔ Evento ↔ Mensaje | JARVIS no relaciona "Carlos + Acme + factura + diciembre" |
| `getUserContext` en `jarvis-gateway` | Solo trae 15 memorias + 5 emails + tareas + WHOOP. **No hace retrieval semántico** sobre la pregunta concreta | Cada respuesta arranca a ciegas |

## Diagnóstico en una frase
**Existe una arquitectura RAG sofisticada pero aislada del flujo conversacional personal**. El histórico (WhatsApp, email, transcripciones) se acumula como datos crudos sin vectorizar, y la memoria activa (`jarvis_memory`) prácticamente no se alimenta. JARVIS responde con contexto superficial porque no hay capa de retrieval entre la pregunta y los datos.

---

# Plan de cambios — por orden de impacto

Lo divido en **3 capas**. Aplico hoy las dos primeras (la base estructural y el primer flujo de retrieval). La tercera (knowledge graph personal) la dejo planificada para iteración siguiente porque requiere decisiones de modelado que prefiero confirmar contigo.

---

### 🟢 CAPA 1 — Infraestructura unificada de memoria histórica (HOY)

#### 1.1 Crear tabla `jarvis_history_chunks` (núcleo de memoria histórica)
Una sola tabla que normaliza TODO el histórico vectorizable en chunks, con embedding, metadata y enlaces a la fuente original.

```
jarvis_history_chunks
├── id, user_id
├── source_type: enum('whatsapp','email','transcription','attachment','calendar','contact_note','jarvis_chat','manual')
├── source_id: uuid     -- FK lógico a la fila origen (no FK física, para no acoplar)
├── source_table: text  -- 'contact_messages' | 'jarvis_emails_cache' | etc
├── content: text       -- el chunk normalizado
├── content_summary: text -- 1-2 frases (lo que va en el prompt si no cabe entero)
├── embedding: vector(1024)  -- text-embedding-3-small, mismas dims que el resto del sistema
├── tsv: tsvector       -- BM25 español para híbrido
├── chunk_index: int
├── occurred_at: timestamptz  -- cuándo pasó el evento real (no created_at del chunk)
├── people: uuid[]      -- contact_ids relacionados
├── topics: text[]      -- ['factura','reunión','familia']
├── importance: smallint -- 1-10, calculado al ingestar
├── metadata: jsonb     -- {channel, thread_id, subject, attachments...}
├── created_at, updated_at
```

- Índices: HNSW sobre `embedding` (cosine), GIN sobre `tsv`, btree sobre `(user_id, source_type, occurred_at desc)`, GIN sobre `people`.
- RLS: `user_id = auth.uid()` + service_role full.
- RPCs: `search_history_hybrid(query_embedding, query_text, p_user_id, source_types[], people[], date_from, date_to, limit)` con RRF (mismo patrón que `search_rag_hybrid` que ya existe).

#### 1.2 Tabla `jarvis_ingestion_jobs` (cola de procesado)
Cola sencilla con `status (pending/running/done/error)`, `source_type`, `source_id`, `payload`, `attempts`. Reaprovecho el patrón de `rag_jobs`.

#### 1.3 Limpieza: deprecar duplicados
- `conversation_embeddings` queda como **legacy** (se mantiene para no romper `search-rag`, pero los nuevos inserts van a `jarvis_history_chunks`).
- `specialist_memory` queda para preferencias declaradas del usuario; no es histórico.

---

### 🟡 CAPA 2 — Pipeline de ingestión real (HOY)

#### 2.1 Edge function nueva: `jarvis-history-ingest`
- Endpoint único con dos modos:
  - `mode: 'single'` → procesa una fila concreta (lo llaman los triggers/edge funcs existentes cuando llega un email nuevo, mensaje WhatsApp, transcripción, etc).
  - `mode: 'backfill'` → procesa por lotes el histórico ya existente. Coge N filas de `source_type` X sin chunk asociado, las normaliza, chunkea (≈800-1200 tokens, overlap 100), genera embedding con `text-embedding-3-small@1024`, calcula `importance` con heurística (longitud + keywords + presencia de personas) y `topics` con un mini-LLM call (gemini-flash, una sola llamada por chunk con prompt ultra-corto JSON).
- Rate limit: 200ms entre embeddings, lotes de 50.
- Idempotente: hash del contenido para no duplicar.

#### 2.2 Wiring de los triggers de ingestión
Engancho el `mode:'single'` en estos puntos (cambios mínimos, fire-and-forget):
- `email-sync` → al insertar en `jarvis_emails_cache` con `body_text`.
- `evolution-webhook` + `import-whatsapp-backup` → al insertar en `contact_messages`.
- `process-transcription` → en lugar de escribir a `conversation_embeddings`, escribe a `jarvis_history_chunks` (mantener fallback dual durante 1 sprint).
- `business_project_timeline_attachments` → cuando se cree un attachment con texto extraído.
- `contact-analysis` → notas del contacto generadas por IA.

#### 2.3 Backfill inicial (programado, no bloqueante)
- Un worker cron (`jarvis-history-backfill-cron`) que cada 5 min coge 100 filas pendientes y las procesa. Empieza por:
  1. Últimos 90 días de `contact_messages` (los más relevantes ahora).
  2. Últimos 90 días de `jarvis_emails_cache`.
  3. Todas las `transcriptions` y `plaud_transcriptions`.
  4. Después: histórico completo en background.
- Coste estimado de OpenAI embeddings para el backfill inicial (~150k chunks tras agrupar mensajes cortos en ventanas): ~$15-30 una vez. Te aviso si se dispara.

#### 2.4 Retrieval real en `jarvis-gateway`
Modifico `getUserContext()` para que, **además del contexto estático actual**, haga retrieval semántico:
- Embedding del mensaje del usuario.
- `search_history_hybrid` filtrado por personas detectadas en el mensaje (fuzzy match contra `people_contacts`) y rango temporal inferido si se menciona ("la semana pasada", "en marzo").
- Top 8 chunks → inyectados en el system prompt en una sección `📚 HISTÓRICO RELEVANTE` con cita de fuente (`[email Carlos 2026-03-12]`, `[wa Guadalupe 2026-04-08]`).
- Coste por turno: 1 embedding + 1 query SQL. Latencia +200ms aprox.

#### 2.5 Memoria activa real
Cambio la heurística pobre actual: cada turno de chat, además de guardar el mensaje, llamo a `gemini-flash` con prompt corto que extrae:
- ¿Hay un hecho persistente nuevo? (ej. "mi mujer se llama X", "trabajo con Acme")
- ¿Hay una preferencia? ("prefiero reuniones por la mañana")
- ¿Hay un compromiso/intención? ("quiero llamar a Carlos esta semana")
→ Esos van a `jarvis_memory` con `memory_type` correcto e `importance` alto. Lo demás se descarta. Esto es la diferencia entre "guardar todo y que el LLM se ahogue" y "guardar lo que importa".

---

### 🔵 CAPA 3 — Knowledge graph personal (PRÓXIMA ITERACIÓN, no hoy)
Reaprovechando `rag_knowledge_graph_nodes/edges` con un nuevo `graph_type='personal'`:
- Nodos: Persona, Empresa, Proyecto, Tema, Evento, Compromiso.
- Edges: `mentioned_in`, `participated_in`, `related_to`, `committed_to`.
- Construido a partir de los chunks ya vectorizados (extracción con LLM por lotes).
- Permite preguntas tipo "qué tengo pendiente con Acme" → grafo + retrieval combinados.

Lo dejo planificado pero no lo aplico hoy porque (a) requiere que Capa 1+2 lleven datos suficientes, (b) la decisión de qué entidades modelar conviene confirmarla viendo los primeros resultados.

---

## Lo que voy a tocar HOY (ficheros)

1. **Migración SQL** (capa 1): `jarvis_history_chunks` + `jarvis_ingestion_jobs` + RPC `search_history_hybrid` + índices + RLS.
2. **Nueva edge function**: `supabase/functions/jarvis-history-ingest/index.ts` (modos single + backfill).
3. **Nueva edge function**: `supabase/functions/jarvis-history-backfill-cron/index.ts` (programada cada 5 min).
4. **Editar** `supabase/functions/email-sync/index.ts` → disparar ingest tras insert.
5. **Editar** `supabase/functions/evolution-webhook/index.ts` → idem para WhatsApp entrante.
6. **Editar** `supabase/functions/process-transcription/index.ts` → escribir a `jarvis_history_chunks` (mantener escritura dual a `conversation_embeddings` 1 sprint).
7. **Editar** `supabase/functions/jarvis-gateway/index.ts` → añadir retrieval semántico + nueva extracción de memoria con LLM.
8. **Editar** `supabase/functions/jarvis-realtime/index.ts` → mismo cambio de memoria activa.
9. **Editar** `supabase/functions/contact-analysis/index.ts` → ingestar notas generadas.
10. **Frontend mínimo**: tarjeta en `/dashboard` (`MemoryHealthCard`) con cobertura del backfill (`X de Y mensajes vectorizados`), para que veas el progreso.

## Lo que NO toco hoy

- Pattern Detector / Expert Forge (RAGs verticales) — están bien, no se mezclan.
- `jarvis_memory` legacy — sigue funcionando, sólo cambio quién la alimenta.
- UI de chat — ningún cambio visible salvo que las respuestas pasan a tener histórico real.
- Modelos de IA — uso `text-embedding-3-small@1024` (ya en el sistema) y `gemini-flash` para extracción/topics (ya en el sistema, vía Lovable AI Gateway).

## Coste/riesgos

- **Coste recurrente OpenAI embeddings**: ~$0.02 por cada 1000 chunks nuevos. Para tu volumen actual (≈100-500 mensajes/día) → céntimos al mes. El backfill inicial es one-shot.
- **Coste de retrieval por turno**: 1 embedding (~$0.00002) + query Postgres. Despreciable.
- **Riesgo principal**: el backfill mete carga al embedding API. Lo limito a 100 chunks/5min (=1200/h) para no romper nada y poder pausarlo.
- **Privacidad**: todo se queda en tu Supabase, RLS estricto. Nada sale a terceros salvo el contenido del chunk al embedding API (que ya está en tu pipeline actual).

## Resultado tras Capa 1+2

- JARVIS contesta "qué me dijo Carlos sobre la factura" recuperando los 5 mensajes/emails reales con cita de fuente y fecha.
- Las menciones a personas activan retrieval automático filtrado por contacto.
- La memoria activa deja de estar vacía: cada conversación deposita 0-3 hechos persistentes de calidad.
- Tienes una tarjeta en dashboard con cobertura: "705.123 mensajes / 12.456 vectorizados (1.7%) — backfill activo".

---

¿Apruebo y empiezo por la migración SQL + las dos nuevas edge functions, y luego enchufo los triggers? ¿O quieres que ajuste algo del alcance antes (p.ej. reducir las fuentes del backfill inicial, dejar Telegram/Plaud para después, o hacerlo solo para los últimos 30 días en vez de 90)?

