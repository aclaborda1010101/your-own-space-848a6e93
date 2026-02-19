
# Modulo de Proyectos y Oportunidades de Negocio

Este es un modulo complejo que toca base de datos, backend (edge functions) y frontend. Se implementara en **5 fases incrementales**, cada una funcional por si misma.

---

## Fase 1: Base de datos — Tablas y relaciones

Se crearan 3 tablas nuevas (no se reutiliza `projects` que es para guiones de cine, ni `ideas_projects` que es para ideas sueltas):

### Tabla `business_projects`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| name | text NOT NULL | Nombre descriptivo del proyecto |
| status | text DEFAULT 'nuevo' | nuevo/en_conversacion/propuesta_enviada/negociacion/ganado/perdido/pausado/descartado |
| origin | text | plaud/whatsapp/email/manual |
| origin_source_id | text | ID de la transcripcion/email/mensaje origen |
| detected_at | timestamptz DEFAULT now() | Cuando se detecto la oportunidad |
| primary_contact_id | uuid REFERENCES people_contacts(id) | Contacto principal |
| company | text | Empresa/organizacion |
| estimated_value | numeric | Valor en EUR |
| close_probability | text DEFAULT 'media' | alta/media/baja |
| need_summary | text | Que necesita el cliente (briefing) |
| need_why | text | Por que lo necesita |
| need_deadline | text | Para cuando |
| need_budget | text | Presupuesto mencionado |
| need_decision_maker | text | Quien decide |
| need_source_url | text | Link a la transcripcion/fuente |
| analysis | jsonb | Analisis IA del proyecto (senales, salud, etc.) |
| closed_at | timestamptz | Fecha de cierre |
| close_reason | text | Motivo de cierre (si perdido) |
| notes | text | Notas libres |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### Tabla `business_project_contacts`
Vincula contactos a proyectos con roles especificos.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| project_id | uuid REFERENCES business_projects(id) ON DELETE CASCADE | |
| contact_id | uuid REFERENCES people_contacts(id) ON DELETE CASCADE | |
| role | text NOT NULL | cliente/decisor/influencer/colaborador_interno/socio/competidor |
| notes | text | Contexto del rol |
| created_at | timestamptz DEFAULT now() | |

Constraint UNIQUE(project_id, contact_id).

### Tabla `business_project_timeline`
Eventos del timeline, tanto automaticos como manuales.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| project_id | uuid REFERENCES business_projects(id) ON DELETE CASCADE | |
| event_date | timestamptz NOT NULL | |
| channel | text NOT NULL | plaud/whatsapp/email/manual/calendar |
| title | text NOT NULL | Titulo del evento |
| description | text | Detalle |
| source_id | text | ID de la fuente (email_id, transcription_id, etc.) |
| contact_id | uuid REFERENCES people_contacts(id) | Contacto involucrado |
| auto_detected | boolean DEFAULT false | Si fue detectado automaticamente |
| created_at | timestamptz DEFAULT now() | |

Indices en (project_id, event_date), (project_id, channel).

### Columna nueva en `tasks`
- `project_id` uuid REFERENCES business_projects(id) ON DELETE SET NULL — para vincular tareas a proyectos

RLS: todas las tablas con politica `user_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE. `business_project_contacts` y `business_project_timeline` usan un subquery al project para verificar el user_id.

---

## Fase 2: Frontend — Pagina de Proyectos y Pipeline

### Nueva pagina `/projects`
Componente `src/pages/Projects.tsx` con:

1. **Vista Pipeline** (por defecto): tarjetas agrupadas por estado con resumen de valor total, valor ponderado, y alertas
2. **Vista detalle de proyecto**: al hacer clic en un proyecto, panel lateral o pagina interna con:
   - Cabecera (nombre, estado, valor, probabilidad, contacto principal)
   - Seccion "Necesidad" (el briefing extraido)
   - Contactos involucrados con roles
   - Timeline cronologico
   - Tareas del proyecto (filtro de la tabla `tasks` por `project_id`)
   - Analisis IA (si existe)
3. **Crear proyecto manual**: dialog con formulario para nombre, contacto principal, empresa, valor estimado, necesidad

### Integracion con rutas existentes
- Nuevo item en sidebar ("Proyectos" con icono Briefcase en seccion profesional)
- Ruta `/projects` en App.tsx
- En la pagina de Tasks: las tareas con `project_id` muestran tag `[NombreProyecto]`
- En StrategicNetwork (perfil contacto, vista profesional): seccion "Proyectos activos" listando proyectos donde participa

### Hook `useProjects`
- `src/hooks/useProjects.tsx`
- CRUD de proyectos, contactos del proyecto, timeline entries
- Computed: pendingProjects, activeProjects, closedProjects, pipelineValue

---

## Fase 3: Vinculacion de tareas a proyectos

### Cambios en `useTasks`
- Agregar campo `project_id` opcional al crear/editar tarea
- El tipo `Task` incluye `projectId?: string` y `projectName?: string`

### Cambios en pagina Tasks
- Badge `[NombreProyecto]` en tareas vinculadas
- Al crear tarea desde un proyecto, se auto-vincula

---

## Fase 4: Edge Function — Deteccion automatica de oportunidades

### Nueva edge function `project-opportunity-detector`
Se invoca desde:
- `process-transcription` (al procesar Plaud)
- `email-intelligence` (al analizar emails personales)

Logica:
1. Recibe texto + contactos involucrados + canal
2. Usa Gemini Flash para detectar senales de oportunidad (las definidas en la spec)
3. Si detecta oportunidad con confianza alta:
   - Crea una entrada en `suggestions` con `suggestion_type = 'project_opportunity'`
   - El content JSONB incluye: nombre sugerido, contacto, empresa, necesidad, valor estimado, fuente
4. El usuario ve la sugerencia en el dashboard y decide crear o ignorar

### Modificacion de `email-intelligence`
- Al final del analisis, si `intent = 'action_required'` o se detectan keywords de proyecto, invocar `project-opportunity-detector`

### Modificacion de `process-transcription`
- Al final del procesamiento, si se detectan entidades de tipo "oportunidad", invocar `project-opportunity-detector`

---

## Fase 5: Timeline automatico y asociacion de mensajes

### Edge function `project-timeline-sync`
Se invoca periodicamente o al procesar nuevas interacciones:
1. Para cada proyecto activo, busca interacciones recientes con sus contactos
2. Evalua si la interaccion es relevante al proyecto (por keywords del briefing, contexto temporal)
3. Si confianza alta: inserta en `business_project_timeline` con `auto_detected = true`
4. Si confianza media: crea sugerencia para que el usuario confirme

### Transiciones automaticas sugeridas
Al detectar envio de propuesta en email → sugerir cambio de estado
Sin interaccion 30 dias → sugerir pausar

---

## Orden de implementacion recomendado

1. **Fase 1** — Base de datos (migracion SQL)
2. **Fase 2** — Frontend: pagina de proyectos con CRUD manual
3. **Fase 3** — Vinculacion de tareas
4. **Fase 4** — Deteccion automatica (edge function)
5. **Fase 5** — Timeline automatico

Las fases 1-3 dan un modulo funcional completo para gestion manual. Las fases 4-5 agregan la inteligencia automatica.

## Detalle tecnico

### Archivos nuevos
| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Projects.tsx` | Pagina principal del modulo |
| `src/hooks/useProjects.tsx` | Hook CRUD para proyectos |
| `supabase/functions/project-opportunity-detector/index.ts` | Deteccion de oportunidades (fase 4) |
| `supabase/functions/project-timeline-sync/index.ts` | Sincronizacion de timeline (fase 5) |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Ruta `/projects` |
| `src/components/layout/SidebarNew.tsx` | Item "Proyectos" en navegacion |
| `src/hooks/useTasks.tsx` | Campo `projectId` en tipo Task |
| `src/pages/Tasks.tsx` | Badge de proyecto en tareas vinculadas |
| `src/pages/StrategicNetwork.tsx` | Seccion "Proyectos activos" en perfil contacto |
| `supabase/functions/email-intelligence/index.ts` | Invocacion de detector de oportunidades |
| `supabase/functions/process-transcription/index.ts` | Invocacion de detector de oportunidades |
| `supabase/config.toml` | Nuevas edge functions |
| `src/integrations/supabase/types.ts` | Auto-actualizado por migracion |

### Migracion SQL (1 migracion)
- CREATE TABLE business_projects + RLS
- CREATE TABLE business_project_contacts + RLS + UNIQUE constraint
- CREATE TABLE business_project_timeline + RLS + indices
- ALTER TABLE tasks ADD COLUMN project_id
- Trigger updated_at en business_projects
