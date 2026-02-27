

## Plan: Generación de documentos descargables por fase

### Alcance

Implementar descarga de documentos profesionales (DOCX) desde cada fase del pipeline, con sección de documentos generados y descarga ZIP.

### 1. Migración DB

Añadir columnas a `project_documents`:
- `file_url` (text, nullable)
- `file_format` (text, default 'markdown')
- `is_client_facing` (boolean, default false)

Crear bucket de Storage `project-documents` (público para descarga con URLs firmadas).

### 2. Edge Function `generate-document`

Nueva edge function que:
- Recibe: `{ projectId, stepNumber, content, contentType: "markdown" | "json", projectName, company, date, version }`
- Usa `npm:docx` para generar DOCX profesional con:
  - Portada (nombre proyecto, cliente, fecha, versión, "Confidencial")
  - Índice automático desde headers markdown
  - Headers/footers con nombre proyecto + "Confidencial" + paginación
  - Tipografía profesional
  - Para JSON: convierte a secciones formateadas según la fase (briefing con secciones, auditoría con tabla de hallazgos, etc.)
- Sube el archivo a Storage `project-documents/{projectId}/{stepNumber}/v{version}.docx`
- Inserta/actualiza registro en `project_documents`
- Devuelve URL firmada temporal

### 3. Componente `ProjectDocumentDownload`

Botón "Descargar DOCX" que aparece en:
- `ProjectWizardGenericStep` — junto a "Regenerar" y "Aprobar"
- `ProjectWizardStep2` — junto a acciones existentes
- `ProjectWizardStep3` — junto a "Exportar"

Al pulsar: llama a la edge function, muestra spinner, descarga el archivo.

### 4. Componente `ProjectDocumentsPanel`

Nueva sección debajo del stepper en `ProjectWizard.tsx`:
- Tabla con: Documento | Fase | Versión | Estado | Acciones (DOCX)
- Solo muestra fases con output generado
- Botón "Descargar todo (ZIP)" que genera un ZIP client-side con JSZip (ya instalado) descargando todos los DOCX disponibles

### 5. Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/generate-document/index.ts` | Crear |
| `supabase/config.toml` | Añadir función |
| `src/components/projects/wizard/ProjectDocumentDownload.tsx` | Crear |
| `src/components/projects/wizard/ProjectDocumentsPanel.tsx` | Crear |
| `src/components/projects/wizard/ProjectWizardGenericStep.tsx` | Añadir botón descarga |
| `src/components/projects/wizard/ProjectWizardStep2.tsx` | Añadir botón descarga |
| `src/components/projects/wizard/ProjectWizardStep3.tsx` | Añadir botón descarga |
| `src/pages/ProjectWizard.tsx` | Añadir panel documentos |
| Migración SQL | Columnas + bucket |

### 6. Formato DOCX por fase

- **Fases markdown (3, 5, 7)**: Parseo de headers → HeadingLevel, listas → bullet points, párrafos → texto normal. Portada + índice + contenido.
- **Fases JSON (2, 4, 6, 8, 9)**: Transformación específica:
  - F2 (Briefing): Secciones con objetivos, stakeholders como tabla, alertas
  - F4 (Auditoría): Tabla de hallazgos con severidad
  - F6 (Auditoría IA): Cards por oportunidad con ROI
  - F8 (RAGs): Resumen de chunks y taxonomía
  - F9 (Patrones): Oportunidades comerciales + score

### 7. Paleta brand Agustito

Definir en la edge function:
- Primario: `#6366F1` (indigo)
- Secundario: `#8B5CF6` (violet)
- Texto: `#1E293B` (slate-800)

### Notas técnicas

- La librería `docx` (npm) funciona en Deno via `npm:docx`
- El DOCX se genera en memoria como Buffer, se sube a Storage, se devuelve URL firmada
- El ZIP se genera client-side con JSZip (ya instalado) descargando los DOCX individuales
- No se genera PDF nativo (complejidad excesiva en Deno); el DOCX es suficiente y más editable por el cliente

