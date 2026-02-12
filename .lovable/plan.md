

# Integracion MVP v2 — Proyectos, Ideas, Sugerencias y CRM

## Que cambia en v2 respecto a v1

El documento v2 anade tres bloques nuevos importantes que no existian en la primera version:

1. **Seccion Proyectos e Ideas** — Captura automatica de ideas desde transcripciones, estados de madurez (Semilla, Explorando, Definiendo, En marcha, Aparcado, Descartado), Kanban board, scoring por frecuencia de mencion
2. **Sistema de Sugerencias validables** — Bandeja de acciones sugeridas tras procesar transcripciones (crear tarea, anadir evento, crear ficha persona) con aprobacion/rechazo y aprendizaje
3. **Fichas de persona mejoradas (CRM)** — Scoring automatico (frecuencia, fiabilidad, iniciativa), etiquetas IA, timeline de interacciones, alertas de inactividad, vista CRM profesional

---

## Bloque A: Proyectos e Ideas (PRIORIDAD ALTA)

### A.1 Nueva tabla `ideas_projects`

Campos: id, user_id, name, description, origin (plaud/manual/wa/email), maturity_state (seed/exploring/defining/active/parked/discarded), category (business/tech/personal/family/investment), mention_count, interest_score, related_people (jsonb), notes (jsonb array), created_at, updated_at

### A.2 Extraccion de ideas desde process-transcription

Ampliar el prompt de Claude en `process-transcription` para que tambien detecte ideas y proyectos mencionados. Anadir campo `ideas` al JSON de respuesta. Guardarlas automaticamente en `ideas_projects` con estado "seed".

Si la idea ya existe (match por nombre similar), incrementar `mention_count` y anadir nota con nuevo contexto. Si supera 3 menciones, cambiar estado a "exploring" automaticamente.

### A.3 Nueva pagina `/projects` — Tablero de Ideas

Pagina con dos vistas:
- **Kanban**: Columnas por estado de madurez (Semilla, Explorando, Definiendo, En marcha)
- **Lista**: Ordenada por scoring de interes

Cada tarjeta muestra: nombre, descripcion, personas vinculadas, menciones, estado, fecha de captura. Click para ver/editar detalle. Boton para crear idea manual.

### A.4 Navegacion

Anadir "Proyectos" al sidebar (con icono Lightbulb) y ruta en App.tsx.

---

## Bloque B: Sistema de Sugerencias (PRIORIDAD ALTA)

### B.1 Nueva tabla `suggestions`

Campos: id, user_id, type (task/event/person/idea/follow_up), content (jsonb con datos de la sugerencia), status (pending/accepted/rejected), source_transcription_id, created_at

### B.2 Generar sugerencias desde process-transcription

Tras el procesamiento, ademas de guardar datos directamente, generar sugerencias pendientes de validacion:
- "Reunion con X el jueves 10:00 → Anadir al calendario?"
- "Enviar presupuesto a Laura → Crear tarea?"
- "Nueva idea: app de reservas → Guardar en Proyectos?"

Ampliar el prompt de Claude para generar array de `suggestions` con tipo y datos.

### B.3 Panel de sugerencias en Inbox

Anadir seccion en la pagina Inbox que muestre sugerencias pendientes con botones Aprobar / Rechazar. Al aprobar: crear la entidad correspondiente (tarea, evento, persona, idea). Al rechazar: marcar como rechazada.

---

## Bloque C: CRM de Personas mejorado (PRIORIDAD MEDIA)

### C.1 Ampliar tabla `people_contacts`

Anadir columnas: empresa, rol, wa_id, email, scores (jsonb: frequency, reliability, initiative), ai_tags (text array), sentiment.

### C.2 Nueva pagina `/contacts` — Vista CRM

Pagina con lista de contactos agrupados por cerebro (Profesional/Personal/Bosco). Cada ficha muestra: nombre, relacion, ultimo contacto, interacciones, tags IA, scoring.

Alertas de inactividad: "Hace X dias sin contacto con Y".

### C.3 Navegacion

Anadir "Contactos" al sidebar con icono Users.

---

## Detalles tecnicos

### Tablas SQL

```text
ideas_projects:
  id uuid PK, user_id uuid FK, name text, description text,
  origin text (plaud/manual/wa/email), 
  maturity_state text (seed/exploring/defining/active/parked/discarded),
  category text, mention_count int default 1, interest_score float default 0,
  related_people jsonb, notes jsonb default '[]',
  source_transcription_id uuid FK nullable,
  created_at timestamptz, updated_at timestamptz
  RLS: user_id = auth.uid()

suggestions:
  id uuid PK, user_id uuid FK, 
  suggestion_type text (task/event/person/idea/follow_up),
  content jsonb, status text (pending/accepted/rejected),
  source_transcription_id uuid FK nullable,
  created_at timestamptz
  RLS: user_id = auth.uid()

ALTER people_contacts ADD:
  company text, role text, wa_id text, email text,
  scores jsonb default '{}', ai_tags text[] default '{}',
  sentiment text
```

### Edge Function changes

- `process-transcription`: Ampliar prompt para extraer ideas + generar sugerencias. Guardar ambos en sus tablas respectivas.

### Nuevas paginas

- `src/pages/Projects.tsx` — Kanban + lista de ideas
- `src/pages/Contacts.tsx` — Vista CRM de personas

### Ficheros modificados

- `src/App.tsx` — Nuevas rutas /projects y /contacts
- `src/components/layout/SidebarNew.tsx` — Nuevos items de navegacion
- `src/pages/Inbox.tsx` — Seccion de sugerencias pendientes
- `supabase/functions/process-transcription/index.ts` — Prompt ampliado + guardado de ideas y sugerencias

---

## Orden de implementacion

1. Migracion SQL (tablas + columnas nuevas)
2. Edge function actualizada (ideas + sugerencias)
3. Pagina Projects (Kanban)
4. Pagina Contacts (CRM)
5. Panel de sugerencias en Inbox
6. Navegacion actualizada

