

## Plan: Visibilidad de Proyectos (Público/Privado) + Confirmación de Aislamiento de Datos

### Contexto
Los proyectos de negocio (`business_projects`) actualmente solo son visibles por su creador o mediante `resource_shares`. El usuario quiere añadir la opción de marcar proyectos como "públicos" para que cualquier usuario autenticado pueda verlos. Todo lo demás (tareas, calendario, contactos, WhatsApp, red estratégica) debe permanecer estrictamente aislado por usuario.

### Cambios

**1. Migración SQL: columna `is_public` + RLS actualizado**
- Añadir columna `is_public BOOLEAN DEFAULT false` a `business_projects`
- Actualizar la política RLS de SELECT para que incluya: `user_id = auth.uid() OR is_public = true OR has_shared_access(...)`
- Las políticas de UPDATE/DELETE siguen siendo solo para el propietario (o editor compartido)
- Las tablas auxiliares de proyecto (wizard_steps, documents, costs, timeline, contacts) heredan acceso vía `user_owns_business_project()` que ya incluye shared_access; actualizar esa función para incluir `is_public`

**2. UI: Toggle público/privado en proyectos**
- En la página de Projects y en el ProjectWizard, añadir un switch/toggle "Público" junto al proyecto
- Icono de candado (privado) o globo (público) visible en las tarjetas de proyecto
- Al cambiar, llamar a `updateProject(id, { is_public: true/false })`

**3. Hook `useProjects`: soporte para `is_public`**
- Añadir `is_public` al tipo `BusinessProject`
- Incluir el campo en `createProject` y `updateProject`

**4. Verificación de aislamiento existente**
- El sistema ya usa `user_id = auth.uid()` en RLS para: tasks, people_contacts, contact_messages, calendar (iCloud por usuario), check_ins, user_settings, conversation_history
- `resource_shares` permite compartir individualmente proyectos, tareas, contactos, calendar, etc.
- WhatsApp (Evolution) ya está vinculado por `user_integrations` con `user_id`
- No se requieren cambios adicionales para el aislamiento; ya está implementado correctamente

### Detalles técnicos

Migración SQL:
```sql
ALTER TABLE public.business_projects 
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Actualizar función que verifica acceso a proyecto
CREATE OR REPLACE FUNCTION public.user_owns_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id 
      AND (user_id = auth.uid() 
           OR is_public = true
           OR has_shared_access(auth.uid(), 'business_project', p_project_id))
  );
$$;

-- Actualizar política SELECT de business_projects
DROP POLICY IF EXISTS "..." ON public.business_projects;
CREATE POLICY "Users can view own, public, or shared projects"
  ON public.business_projects FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR is_public = true 
    OR has_shared_access(auth.uid(), 'business_project', id)
  );
```

Archivos a modificar:
- `supabase/migrations/` — nueva migración
- `src/hooks/useProjects.tsx` — añadir `is_public` al tipo y operaciones
- `src/pages/Projects.tsx` — toggle y badge visual
- `src/pages/ProjectWizard.tsx` — toggle en edición

