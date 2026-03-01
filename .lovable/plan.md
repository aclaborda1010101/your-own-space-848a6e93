

## Plan: Sistema de colaboración entre usuarios

### Concepto
Crear una tabla central `resource_shares` que permita a un usuario compartir cualquier recurso (proyecto, tarea, RAG, detector, contactos, datos) con otro usuario, con un rol específico (viewer/editor). Los hooks y RLS se actualizan para que las queries incluyan recursos propios + compartidos.

### Tablas nuevas

**`resource_shares`** — tabla central de permisos compartidos:
- `id` uuid PK
- `owner_id` uuid NOT NULL (quien comparte)
- `shared_with_id` uuid NOT NULL (a quién se comparte)
- `resource_type` text NOT NULL — `business_project`, `task`, `rag_project`, `pattern_detector_run`, `people_contact`, `calendar`
- `resource_id` uuid NULL — ID específico del recurso (NULL = todos los de ese tipo)
- `role` text NOT NULL DEFAULT `viewer` — `viewer` o `editor`
- `created_at` timestamptz DEFAULT now()
- UNIQUE(owner_id, shared_with_id, resource_type, resource_id)

**`user_directory`** — para buscar usuarios con quién compartir:
- Vista ligera: `id`, `email`, `display_name` desde `auth.users` metadata (o tabla profiles si existe)

### Función de seguridad (SECURITY DEFINER)

```sql
CREATE FUNCTION public.has_shared_access(
  p_user_id uuid, p_resource_type text, p_resource_id uuid
) RETURNS boolean
```
Verifica si el usuario tiene acceso compartido (directo por resource_id o global por tipo).

```sql
CREATE FUNCTION public.has_shared_edit_access(
  p_user_id uuid, p_resource_type text, p_resource_id uuid
) RETURNS boolean
```
Igual pero solo para role = 'editor'.

### Cambios en RLS policies

Para cada tabla afectada (`business_projects`, `tasks`, `rag_projects`, `pattern_detector_runs`, `people_contacts` y sus tablas auxiliares):

- **SELECT**: `user_id = auth.uid() OR has_shared_access(auth.uid(), '<type>', id)`
- **UPDATE/DELETE**: `user_id = auth.uid() OR has_shared_edit_access(auth.uid(), '<type>', id)`
- **INSERT**: mantener `user_id = auth.uid()` (solo el dueño crea)

Tablas auxiliares (`project_wizard_steps`, `project_documents`, `project_costs`, `business_project_contacts`, `business_project_timeline`, `data_sources_registry`, `signal_registry`, `model_backtests`, etc.) heredan acceso via su `project_id` o `rag_id` padre.

### Cambios en hooks (frontend)

1. **`useProjects`**: Quitar filtro `.eq("user_id", user.id)` — RLS se encarga. Añadir campo `is_shared` computado.
2. **`useTasks`**: Igual, quitar filtro explícito de user_id en SELECT.
3. **`useRagArchitect`**: El edge function ya filtra por user_id; actualizar para aceptar shared access.
4. **`usePatternDetector`**: Igual.
5. Crear **`useSharing`** hook nuevo: listar shares, crear share (por email), revocar share, buscar usuarios.

### UI nueva

1. **Botón "Compartir"** en cada proyecto/RAG/detector con diálogo:
   - Input de email del usuario destino
   - Selector de rol (viewer/editor)
   - Lista de usuarios con acceso actual + botón revocar
2. **Indicador visual** en listas: badge "Compartido" o avatar del owner si no es tuyo.
3. **Página Settings**: sección "Compartido conmigo" para ver todos los recursos compartidos.

### Orden de implementación

1. Migración SQL: crear `resource_shares`, funciones `has_shared_access`/`has_shared_edit_access`, actualizar RLS en las 7+ tablas principales.
2. Hook `useSharing` + componente `ShareDialog`.
3. Actualizar hooks existentes (quitar filtros `.eq("user_id")` en SELECTs, dejar que RLS filtre).
4. Integrar botón "Compartir" en Projects, RAG Architect, Pattern Detector, Tasks.
5. Badge visual "Compartido" en listas.

### Detalles técnicos

- La búsqueda de usuarios para compartir se hará por email exacto (no exponer lista de usuarios).
- `resource_id = NULL` con `resource_type = 'business_project'` significa "todos los proyectos de ese owner" → útil para compartir workspace completo.
- Las tablas auxiliares (wizard steps, documents, costs, timeline) no necesitan shares propios: heredan del proyecto padre via las funciones `user_owns_business_project` actualizada.
- Edge functions que filtran por user_id (rag-architect, pattern-detector-pipeline) necesitarán consultar `resource_shares` para incluir recursos compartidos.

