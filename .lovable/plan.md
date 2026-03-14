

# Plan: Enviar documento completo a Expert Forge

## Problema

El `PublishToForgeDialog` solo envía el texto del PRD (step 5 `outputData.document`). Expert Forge necesita **todo el contenido del proyecto** — extracción, alcance, auditoría IA, PRD y MVP — para poder crear el RAG con información completa.

## Cambios

### 1. `src/pages/ProjectWizard.tsx`
- Construir `fullDocumentText` concatenando los outputs de **todos los pasos aprobados** (steps 2→5, y 11 si existe):
  - Step 2: `outputData` serializado (source of truth JSON)
  - Step 3: `outputData.document` o `outputData.content` (scope markdown)
  - Step 4: `outputData` serializado (AI audit JSON)
  - Step 5: `outputData.document` (PRD completo)
  - Step 11: `outputData.document` o `outputData.content` (MVP si existe)
- Pasar este `fullDocumentText` como `prdText` al dialog

### 2. `supabase/functions/publish-to-forge/index.ts`
- Añadir `auto_provision: true` al payload enviado al gateway para que Expert Forge cree automáticamente el RAG con el documento recibido
- Aumentar el slice de `200000` a `500000` caracteres para acomodar el documento completo

### 3. `src/components/projects/wizard/PublishToForgeDialog.tsx`
- Actualizar la etiqueta del textarea de "Texto del PRD" a "Documento completo del proyecto"
- Actualizar el placeholder acorde

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `src/pages/ProjectWizard.tsx` | Concatenar todos los steps en `fullDocumentText` |
| `supabase/functions/publish-to-forge/index.ts` | Añadir `auto_provision: true`, aumentar límite de caracteres |
| `src/components/projects/wizard/PublishToForgeDialog.tsx` | Labels actualizados |

