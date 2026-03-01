

## Plan: Auditorías independientes (con o sin proyecto)

### Problema actual
Las 4 tablas BL (`bl_questionnaire_responses`, `bl_diagnostics`, `bl_recommendations`, `bl_roadmaps`) tienen `project_id NOT NULL` y la edge function valida propiedad contra `business_projects`. No se puede crear una auditoría sin proyecto.

### Solución: Nueva tabla `bl_audits` como contenedor

Crear una tabla ligera `bl_audits` que actúe como contenedor. Cada auditoría puede tener un `project_id` opcional. Las 4 tablas BL pasan a referenciar `audit_id` en lugar de `project_id`.

### Cambios

**1. Migración SQL**
- Crear tabla `bl_audits`: `id, user_id, name, project_id (nullable), sector, business_size, business_type, created_at`
- Añadir columna `audit_id` a las 4 tablas BL (nullable para migración gradual)
- Hacer `project_id` nullable en las 4 tablas BL
- Migrar datos existentes: crear un `bl_audit` por cada `project_id` distinto existente y actualizar `audit_id`
- RLS en `bl_audits`: owner + shared access

**2. Edge function `ai-business-leverage`**
- Aceptar `audit_id` en lugar de (o además de) `project_id`
- Validar propiedad contra `bl_audits` en vez de `business_projects`
- Si la auditoría tiene `project_id`, cargar datos del proyecto; si no, usar sector/size de la propia auditoría
- Todas las queries BL filtran por `audit_id`

**3. Frontend — `src/pages/AuditoriaIA.tsx`**
- Reemplazar el selector de proyecto por una lista de auditorías existentes + botón "Nueva Auditoría"
- Diálogo de creación: nombre, proyecto (opcional), sector, tamaño
- Si se selecciona un proyecto, precargar sector/size del proyecto

**4. Hook `useBusinessLeverage`**
- Cambiar parámetro de `projectId` a `auditId`
- Queries BL filtran por `audit_id`
- `callEdge` envía `audit_id`

**5. Componente `BusinessLeverageTabs`**
- Cambiar prop `projectId` → `auditId`
- Mantener `projectSector`/`projectSize` como props opcionales (vienen del audit)

### Detalle técnico — Tabla `bl_audits`

```text
bl_audits
├── id          UUID PK
├── user_id     UUID NOT NULL (auth.uid)
├── name        TEXT NOT NULL
├── project_id  UUID NULL → business_projects
├── sector      TEXT
├── business_size TEXT
├── business_type TEXT
└── created_at  TIMESTAMPTZ
```

### Flujo de usuario
1. Entra en "Auditoría IA"
2. Ve lista de auditorías previas (con badge si están vinculadas a proyecto)
3. Pulsa "Nueva Auditoría" → elige nombre + opcionalmente un proyecto
4. Se abre BusinessLeverageTabs con el audit_id
5. Todo el flujo (cuestionario → diagnóstico → recomendaciones → roadmap) funciona igual

