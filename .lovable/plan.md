

## Plan: Compartición de auditorías + persistencia del cuestionario

### Problema 1: Cuestionario se pierde
Las 4 tablas BL (`bl_questionnaire_responses`, `bl_diagnostics`, `bl_recommendations`, `bl_roadmaps`) tienen RLS que valida `user_owns_business_project(project_id)`. Cuando la auditoría no tiene proyecto vinculado, `project_id` es NULL → la policy falla → los datos se insertan pero no se pueden leer. El cuestionario "desaparece".

### Problema 2: No se comparten auditorías
`bl_audits` RLS solo verifica `auth.uid() = user_id`. No usa `has_shared_access()`. Las auditorías compartidas nunca aparecen en la lista del destinatario.

### Solución

**1. Migración SQL** — Actualizar RLS en las 5 tablas:

- **`bl_audits`**: Añadir `has_shared_access(auth.uid(), 'bl_audit', id)` a las policies SELECT/UPDATE/DELETE.

- **`bl_questionnaire_responses`, `bl_diagnostics`, `bl_recommendations`, `bl_roadmaps`**: Reemplazar la policy actual `user_owns_business_project(project_id)` por una que valide ownership via `audit_id`:
  ```sql
  -- SELECT: owner del audit O acceso compartido
  auth.uid() = (SELECT user_id FROM bl_audits WHERE id = audit_id)
  OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
  -- Fallback legacy: OR user_owns_business_project(project_id)
  ```
  
  Similar para INSERT (WITH CHECK verifica que el audit pertenezca al usuario).

**2. Frontend `AuditoriaIA.tsx`** — Cargar auditorías compartidas:
- Añadir consulta a `resource_shares` para auditorías compartidas con el usuario.
- Mostrarlas en la lista con un badge "Compartido".

**3. `ShareDialog`** — Ya se pasa `resourceType="bl_audit"` en la página. Solo falta que el `resourceId` se pase correctamente (actualmente no se pasa, lo que causa que el share sea genérico).

### Cambios de archivos
- Migración SQL: nuevas RLS policies
- `src/pages/AuditoriaIA.tsx`: cargar auditorías compartidas + pasar `resourceId` al `ShareDialog`

