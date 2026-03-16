

## Plan: Un solo botón "Publicar en Expert Forge"

### Problema
Hay dos botones: "Arquitecturar en Expert Forge" (`autoMode=true`, envía PRD completo) y "Publicar en Expert Forge" (`autoMode=false`, muestra textarea para pegar BUILD_SLICE). Ambos llaman al mismo endpoint con la misma acción `architect` + `auto_provision: true`.

### Qué se envía hoy

**Botón "Arquitecturar"** (autoMode=true):
```json
{
  "action": "create_and_architect",
  "project_id": "<uuid>",
  "project_name": "<project.name>",
  "project_description": "<project.company>",
  "document_text": "<PRD completo del step 3 outputData>",
  "auto_provision": true
}
```

**Botón "Publicar"** (autoMode=false):
```json
{
  "action": "architect",    // default path
  "project_id": "<uuid>",
  "project_name": "<project.name>",
  "project_description": "<project.company>",
  "document_text": "<build_slice_f0_f1 o texto pegado manualmente>",
  "build_mode": "STRICT",
  "source_of_truth": "BUILD_SLICE_F0_F1",
  ... (campos restrictivos)
}
```

Ambos terminan llamando al gateway con `action: "architect"` + `auto_provision: true`. La diferencia es solo qué texto se envía y los campos de contrato.

### Cambio propuesto

Dejar **un solo botón** que envía el PRD completo con `create_and_architect`. Sin textarea manual, sin modo BUILD_SLICE.

### Archivos a modificar

**`src/pages/ProjectWizard.tsx`** (líneas 338-378):
- Eliminar el botón "Publicar en Expert Forge" y su `PublishToForgeDialog` sin `autoMode`
- Eliminar variables `forgeOpen`/`buildSliceText`
- Mantener solo el botón "Publicar en Expert Forge" con `autoMode={true}` y `prdText={fullPrdText}`
- Renombrar estado `forgeArchitectOpen` → `forgeOpen`

**`src/components/projects/wizard/PublishToForgeDialog.tsx`**:
- Eliminar prop `autoMode` y toda la lógica condicional asociada (textarea BUILD_SLICE, labels diferentes)
- Simplificar a un solo flujo: siempre envía `create_and_architect` con PRD completo
- Mantener la visualización de `provisioned_report`, verify, re-arquitectura

El payload final enviado será siempre:
```json
{
  "action": "create_and_architect",
  "project_id": "<uuid>",
  "project_name": "<nombre>",
  "project_description": "<descripción>",
  "document_text": "<PRD completo>",
  "auto_provision": true
}
```

