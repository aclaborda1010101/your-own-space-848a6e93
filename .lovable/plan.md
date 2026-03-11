

# Editar nombre del proyecto desde el wizard

## Cambio

Hacer que el título del proyecto (`project.name`) en la cabecera del wizard sea editable inline. Al hacer clic, se convierte en un input; al confirmar (Enter/blur), se guarda en `business_projects` y se actualiza el state local. Esto asegura que al generar el Resumen Ejecutivo, se use el nombre actualizado.

## Implementación

### 1. `src/hooks/useProjectWizard.ts`
Añadir función `updateProjectName(newName: string)` que:
- Actualice `business_projects.name` via Supabase
- Actualice el state local `project.name`
- Muestre toast de confirmación

### 2. `src/pages/ProjectWizard.tsx` (línea 129)
Reemplazar el `<h1>` estático por un componente inline editable:
- Estado `editingName` + `draftName`
- Click en el nombre o icono de lápiz → muestra `<Input>` con el nombre
- Enter o blur → llama `updateProjectName(draftName)`
- Escape → cancela edición

El nombre ya se pasa como `projectName` a `ProjectProposalExport` y `ProjectDocumentDownload`, así que al actualizar `project.name` en el state, los documentos generados usarán el nombre correcto automáticamente.

| Fichero | Cambio |
|---|---|
| `src/hooks/useProjectWizard.ts` | Añadir `updateProjectName()` |
| `src/pages/ProjectWizard.tsx` | Header con nombre editable inline |

