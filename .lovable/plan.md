

## Plan: Auditorías independientes de proyectos

### Estado actual
- `bl_audits` table ya existe (id, user_id, name, project_id nullable, sector, business_size, business_type)
- Las 4 tablas BL ya tienen columna `audit_id`
- Pero el frontend y la edge function siguen usando `project_id` exclusivamente
- La página solo permite seleccionar un proyecto existente

### Cambios

**1. Página `src/pages/AuditoriaIA.tsx`** — Reescribir completamente:
- Cargar auditorías del usuario desde `bl_audits`
- Lista de auditorías existentes (cards con nombre, sector, badge si tiene proyecto vinculado)
- Botón "Nueva Auditoría" que abre un Dialog con: nombre (obligatorio), proyecto (opcional dropdown), sector, tamaño, tipo de negocio
- Al crear, inserta en `bl_audits` y selecciona la nueva auditoría
- Al seleccionar una auditoría, renderiza `BusinessLeverageTabs` con `auditId`

**2. Hook `src/hooks/useBusinessLeverage.tsx`** — Cambiar de `projectId` a `auditId`:
- Parámetro cambia a `auditId: string`
- `callEdge` envía `audit_id` en vez de `project_id`
- `loadExisting` filtra por `audit_id` en las 4 tablas BL
- Mantener compatibilidad: si hay `project_id` en datos antiguos, sigue funcionando

**3. Edge function `supabase/functions/ai-business-leverage/index.ts`**:
- Aceptar `audit_id` como parámetro principal (mantener `project_id` como fallback)
- Validar propiedad contra `bl_audits` (user_id = userId)
- Si la auditoría tiene `project_id`, cargar datos del proyecto para context
- Si no tiene proyecto, usar sector/size/type de la propia auditoría
- Guardar `audit_id` en todas las inserciones a tablas BL

**4. Componente `BusinessLeverageTabs.tsx`**:
- Cambiar prop `projectId` → `auditId`
- Pasar `auditId` a `useBusinessLeverage`
- Pasar `auditId` a `AuditFinalDocTab`

**5. Otros componentes que usan `BusinessLeverageTabs`** (ej: ProjectWizard):
- Buscar usos y actualizar props — si se usa desde wizard con un projectId, crear/buscar una auditoría asociada

### Flujo de usuario
1. Entra en "Auditoría IA"
2. Ve lista de auditorías previas + botón "Nueva Auditoría"
3. Crea auditoría con nombre + opcionalmente vincula a un proyecto
4. Se abre el flujo de 4 fases (cuestionario → diagnóstico → recomendaciones → roadmap)

### Detalle técnico
- La inserción en `bl_audits` se hace directamente desde el frontend vía Supabase client
- RLS ya está configurado en `bl_audits` para owner access
- La edge function necesita ser re-desplegada tras los cambios

