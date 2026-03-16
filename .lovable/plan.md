

## Plan: Simplificar flujo `publish-to-forge` y alinear con API Gateway real

### Contexto

El API Gateway de Expert Forge (`nhfocnjtgwuamelovncq`) **ya soporta** `architect` con `auto_provision: true`, que auto-crea el proyecto si no existe. La lógica actual de `publish-to-forge` con dos fases (`create_project` + `architect`) es redundante.

Todo lo necesario ya existe en el código:
- `publish-to-forge` edge function con `create_and_architect` y `architect`
- `PublishToForgeDialog` con `autoMode`
- Botones "Arquitecturar" y "Publicar" en `ProjectWizard.tsx`

### Cambios

**1. Simplificar `publish-to-forge/index.ts` — eliminar fase `create_project`**

Reemplazar el bloque `create_and_architect` (líneas 151-217) para que simplemente envíe una sola llamada `architect` con `auto_provision: true`, `project_name` y `project_description`. El Gateway de Expert Forge se encarga de crear el proyecto si no existe.

Resultado: el case `create_and_architect` se convierte en un alias directo de `architect` con `auto_provision: true` + campos de nombre/descripción, eliminando la llamada intermedia a `create_project`.

**2. Archivo a modificar**

- `supabase/functions/publish-to-forge/index.ts` — simplificar `create_and_architect` a una sola llamada gateway con `architect` + `auto_provision: true`

No se necesitan cambios en frontend (`PublishToForgeDialog` y `ProjectWizard.tsx` ya funcionan correctamente).

