

## Dos mejoras coordinadas

### Parte A — Documento de Alcance AFFLUX más funcional, menos "técnico de IA"

**Qué cambia (step 102 del `generate-document`)**

Reescribo la estructura del documento siguiendo lo que pides:

1. **Fotografía inicial del cliente** (nueva sección 1) — Lo que nos contó el cliente: contexto, situación actual, dolores, necesidades, lo que tiene hoy y por qué no le funciona. Sale del briefing/extracción del paso 2.
2. **Cómo lo vamos a resolver** (nueva sección 2) — Narrativa: "una aplicación que hace esto, esto y esto". 8-12 líneas con detalle funcional real (no marketing vacío, no SQL).
3. **Áreas de trabajo** (sección 3, antes "capas") — Mantenemos la organización por áreas funcionales con tareas y badge de complejidad, pero **enriquecida** con el pipeline de 3 pasadas que ya planificamos:
   - Pasada A: inventario exhaustivo del PRD entero por chunks → 40-80 ítems crudos.
   - Pasada B: agrupación en 5-8 áreas (Captación, Scraping externo, Llamada comercial, Cualificación, Seguimiento, Operación, Integraciones, Reporting…) con complejidad realista.
   - Cada tarea: nombre comercial + 1-2 líneas funcionales.
4. **Consumos previstos de IA** (sección 4) — Mantenemos tabla de **uso por servicio** (volumen estimado + coste mensual EUR bajo/esperado/alto). **Eliminamos**:
   - La sección entera de "Stack de IA" con nombres de modelos (Claude, Gemini, etc.).
   - Cualquier mención a `claude-sonnet`, `gpt-5`, `gemini-pro` en el cuerpo del documento.

   Lo agrupamos por **función**, no por modelo: "Análisis conversacional", "Transcripción de llamadas", "Lectura de documentos PDF", "Generación de respuestas comerciales", "Embeddings para búsqueda semántica"… Cada fila: para qué sirve + volumen mensual + EUR/mes.
5. **Planificación temporal** (sección 5) — Igual que ahora (fases + Gantt visual).
6. **Inversión** (sección 6) — Igual que ahora (sin márgenes internos, modelos comerciales seleccionados).
7. **Condiciones y próximos pasos** (sección 7) — Igual.

**Resultado**: ≤15 págs, sin nombres de modelos pero con consumos cuantificados, con áreas de trabajo profundas y con la fotografía inicial del cliente que pediste.

**Archivo único**: `supabase/functions/generate-document/index.ts` — solo el bloque `stepNumber === 102` (~250 líneas). Prompts de pasada A/B se reescriben para no devolver `ai_stack` y devolver `client_snapshot` + `solution_narrative`.

---

### Parte B — JARVIS entiende contactos, proyectos, emails y notas en lenguaje natural

**Diagnóstico verificado en BD**

| Fuente | Filas en BD | Indexado para búsqueda semántica |
|---|---|---|
| WhatsApp | 311 chunks | ✅ Sí |
| Chat JARVIS | 2 chunks | ✅ Sí |
| **Emails** | **805** | ❌ **No** |
| **Proyectos (wizard steps)** | **68 pasos / 12 proyectos** | ❌ **No** |
| **Plaud (transcripciones reuniones)** | tabla existe | ❌ **No** |
| **Notas de contacto** | existe | ❌ **No** |
| Contactos | 2589 | ❌ no fuzzy en gateway |

Por eso JARVIS no sabe nada de "Adflux", del contacto de Adflux, del email que te mandó alguien o del problema mayor del cliente: **esa información existe, pero el knowledge graph no la ve**. Solo tiene WhatsApp.

Ya existen `search_history_hybrid` (ya usado por gateway) y `search_contacts_fuzzy` (sin usar). El enum `jarvis_source_type` ya incluye `email`, `plaud`, `contact_note`, `calendar` — solo falta poblarlos. Falta añadir un valor `project` al enum.

**Qué cambia**

**B.1 — Indexación masiva del knowledge graph (migración + edge function)**

- Añadir `'project'` al enum `jarvis_source_type`.
- Edge function nueva `jarvis-history-backfill` que:
  - Lee emails, plaud, notas de contacto, eventos, y los 12 proyectos (briefing + PRD + alcance + auditoría) de cada usuario.
  - Trocea (~1500 chars), genera embedding (text-embedding-3-small dim 1024 — el mismo que ya usa gateway), e inserta en `jarvis_history_chunks` con `source_type`, `people` (uuid de contactos mencionados), `occurred_at`, `metadata` (project_id si aplica).
  - Idempotente vía `content_hash`. Procesa en lotes para no saturar.
- Disparador inicial: botón en Settings (o llamada manual) + cron nocturno que indexa lo nuevo de cada fuente.
- **Trigger en vivo**: triggers ligeros en `jarvis_emails_cache`, `plaud_recordings`, `business_project_timeline`, `project_wizard_steps` que insertan en `jarvis_ingestion_jobs` (cola que ya existe), procesada por `rag-job-runner`.

**B.2 — Resolución difusa de entidades antes de cada respuesta**

En `jarvis-realtime/index.ts` (botón de voz) y `jarvis-gateway/index.ts` (chat), antes de llamar al LLM:

1. Detectar **candidatos a entidad** en el transcript (palabras capitalizadas, nombres tras "con/de/sobre/a/contacto de", referencias a proyectos).
2. Para cada candidato, en paralelo:
   - `search_contacts_fuzzy(user, term, 3)` → contactos.
   - Comparar contra `business_projects.name` con similarity → proyectos.
3. Si hay match con score alto, inyectar bloque en system prompt:
   ```
   📇 ENTIDADES MENCIONADAS:
   - "Iva" → Iva Abouk (contacto, score 0.92)
   - "Adflux" → AFFLUX (proyecto, score 0.95)
   ```
4. Pasar los uuids resueltos como `p_people` a `search_history_hybrid` para que el RAG semántico devuelva chunks **filtrados por esa persona/proyecto** (no solo por keyword).
5. Si dos candidatos empatan, instruir al prompt: "pregunta para desambiguar" (no quedarse pillado).

**B.3 — Cobertura semántica completa en el contexto**

`jarvis-realtime` hoy no llama a `getSemanticHistory`. Lo añadimos (ya está implementado en gateway, lo portamos). Resultado: la pregunta "¿cuál era el mayor problema en Adflux?" pasa por:

1. Resolver "Adflux" → project AFFLUX + contactos vinculados.
2. `search_history_hybrid` filtrado por ese proyecto + contactos → trae emails, transcripciones Plaud, mensajes WhatsApp, notas, brief del proyecto.
3. Claude responde con esos hechos reales en contexto.

**B.4 — Resiliencia auth (lo del punto 3 anterior)**

Mantenemos lo planificado ya: refresh defensivo + reintento 401 + listener `visibilitychange` en `useJarvisRealtimeVoice.tsx` para que la notificación no rompa la sesión.

---

### Archivos a tocar

| Archivo | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | Reescribe bloque step 102: nueva fotografía cliente + solución narrativa + áreas + consumos sin modelos |
| `supabase/migrations/<new>.sql` | Añade `'project'` al enum + triggers de ingest + índice GIN en nombres de proyectos para fuzzy |
| `supabase/functions/jarvis-history-backfill/index.ts` (nueva) | Backfill masivo de emails/plaud/proyectos/notas → chunks + embeddings |
| `supabase/functions/jarvis-realtime/index.ts` | + `resolveEntities()` + `getSemanticHistory()` + filtro por `people` |
| `supabase/functions/jarvis-gateway/index.ts` | + `resolveEntities()` + filtro por `people`/proyecto en hybrid search |
| `supabase/functions/_shared/entity-resolver.ts` (nueva) | Lógica compartida de detección + fuzzy + scoring |
| `src/hooks/useJarvisRealtimeVoice.tsx` | Refresh defensivo + reintento 401 + visibilitychange |
| `src/pages/Settings.tsx` (mínimo) | Botón "Reindexar todo el knowledge graph" que llama al backfill |

### Sin tocar

- UI del wizard, panel de propuesta, paneles de proyectos.
- Schema de `people_contacts`, `business_projects`, `jarvis_emails_cache`.
- Modelo de TTS/STT.

### Orden de ejecución

1. Parte A (documento AFFLUX) — autocontenido, validable de inmediato.
2. Migración: enum + triggers + índices.
3. `entity-resolver.ts` compartido + integración en gateway y realtime.
4. `jarvis-history-backfill` + botón Settings → primer reindex completo.
5. Resiliencia auth en hook real-time.

