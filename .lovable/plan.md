

# Plan: Historial de Actividad del Proyecto (Timeline)

## Contexto

Ya existe la tabla `business_project_timeline` y las funciones `fetchTimeline` / `addTimelineEntry` en `useProjects.tsx`. Lo que falta es la **UI** dentro del wizard de cada proyecto y la **auto-insercion** de eventos cuando el wizard avanza pasos.

## Cambios

### 1. Nuevo componente: `ProjectActivityTimeline.tsx`

Crear `src/components/projects/wizard/ProjectActivityTimeline.tsx`:

- Panel colapsable (Collapsible) titulado "Historial de actividad" con icono `History`.
- Carga entries de `business_project_timeline` para el `projectId` dado, ordenados por fecha descendente.
- Cada entrada muestra: fecha, canal (badge con icono), titulo, descripcion, contacto asociado (si hay).
- Formulario inline para añadir una entrada manual: fecha, canal (select: llamada/email/reunión/whatsapp/interno/otro), título, descripción opcional, contacto opcional.
- Auto-refresh cada 30s para que colaboradores vean cambios en tiempo real.
- Canales con iconos: Phone, Mail, Users, MessageSquare, Cog, FileText.

### 2. Integrar en `ProjectWizard.tsx`

Añadir el componente `ProjectActivityTimeline` debajo del contenido del paso y encima de `ProjectDocumentsPanel`. Pasarle `projectId`.

### 3. Auto-registro de eventos del wizard

En `useProjectWizard.ts`, dentro de `approveStep()`, insertar automáticamente una entrada en `business_project_timeline` con:
- `channel: "interno"`
- `title: "Paso X aprobado: [nombre del paso]"`
- `auto_detected: true`

Esto crea un registro automático del avance del pipeline sin intervención manual.

### 4. Añadir columna `user_id` a la tabla timeline

Migración SQL para añadir `user_id uuid references auth.users(id)` a `business_project_timeline`, para saber qué agente/usuario registró cada evento. Incluir RLS policy para que solo usuarios del proyecto o con acceso compartido puedan leer/escribir.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/components/projects/wizard/ProjectActivityTimeline.tsx` | Nuevo componente |
| `src/pages/ProjectWizard.tsx` | Importar e integrar timeline |
| `src/hooks/useProjectWizard.ts` | Auto-log en `approveStep` |
| Migración SQL | Añadir `user_id` + RLS |

