

## Plan: Data Snapshot — Fase 1 (Ingesta de datos antes del PRD)

Este plan cubre exclusivamente la **Fase 1** del spec: subida de archivos (Modo 1), análisis con LLM, validación por el usuario, e inyección del `data_profile` en los prompts del PRD/Patrones/RAG.

### Arquitectura

```text
Step 7 (PRD) actual:
  [Generar PRD] → llamadas LLM → PRD

Step 7 nuevo:
  ¿services_decision requiere datos? 
    SÍ → [Pantalla Data Snapshot] → upload/analizar → validar resumen → [Generar PRD con data_profile]
    NO → [Generar PRD] (como antes)
```

El "Data Snapshot" NO es un step nuevo. Es una **sub-fase del Step 7** que aparece condicionalmente antes de generar el PRD.

### Cambios

#### 1. SQL Migration

- Crear tabla `client_data_files` (como en el spec)
- Crear Storage bucket `project-data` (privado, con RLS)
- RLS: owner manages files

#### 2. Edge Function `analyze-client-data/index.ts` (nueva)

Solo Modo 1 (upload) en Fase 1:
- Acción `upload_and_analyze`: recibe archivo vía FormData, lo guarda en Storage, parsea (xlsx/csv/json/txt via heurísticas), envía muestra a Gemini Flash para análisis estructural
- Acción `get_data_profile`: agrega los análisis de todos los archivos del proyecto en un `data_profile` consolidado
- Acción `update_corrections`: guarda correcciones del usuario

Parseo de archivos:
- CSV/TSV: split por líneas, detectar separador
- XLSX/XLS: usar la lógica existente de `xlsx-utils.ts` (ya hay dependencia `xlsx`)
- JSON: parsear directamente
- PDF/TXT: extraer texto plano, analizar estructura con LLM

Análisis LLM (Gemini Flash, barato):
- Input: nombre del archivo + primeras 200 filas + headers
- Output JSON: `column_types`, `variables_detected`, `entities_detected`, `temporal_coverage`, `geographic_coverage`, `quality_score`, `quality_issues`, `business_context`

#### 3. Componente `ProjectDataSnapshot.tsx` (nuevo)

UI con tres estados:
1. **Upload**: Drag & drop de archivos, lista de archivos subidos con status (uploading/analyzing/analyzed/error)
2. **Validación**: Resumen del análisis (entidades, variables, cobertura, calidad), botón editar, botón añadir más, botón confirmar
3. **Skip**: Botón "Continuar sin datos"

Props: `projectId`, `onComplete(dataProfile)`, `onSkip()`

#### 4. Integración en `ProjectWizard.tsx` y `ProjectWizardGenericStep.tsx`

Cuando `currentStep === 7`:
- Leer `services_decision` del Step 6
- Si `rag.necesario || pattern_detector.necesario`:
  - Comprobar si ya hay `data_profile` aprobado (en step output o tabla)
  - Si no → mostrar `ProjectDataSnapshot` en vez del paso genérico
  - Si sí (o skip) → mostrar `ProjectWizardGenericStep` normal
- Si no necesita servicios → comportamiento actual

#### 5. Inyección en prompts (`projectPipelinePrompts.ts`)

Modificar `buildPrdPart1Prompt`, `buildPrdPart2Prompt` y `buildPrdPart4Prompt`:
- Si `params.dataProfile?.has_client_data === true`, inyectar bloque:
  ```
  DATOS REALES DEL CLIENTE:
  - Variables: ${variables con tipos y calidad}
  - Entidades: ${entidades detectadas}
  - Cobertura temporal: ${from} — ${to}
  - Calidad global: ${score}/100
  - Contexto: ${business_context}
  
  USA estos datos reales para calibrar el modelo de datos, 
  las métricas del dashboard, y los rangos de validación.
  ```

#### 6. Hook `useProjectWizard.ts`

- Añadir estado `dataProfile` y `dataPhaseComplete`
- Pasar `dataProfile` dentro de `stepData` al llamar `generate_prd`
- El edge function `project-wizard-step` lo recibe y lo pasa a los prompts

#### 7. Inyección en Pattern Blueprint y RAG

En `project-wizard-step/index.ts`:
- `generate_pattern_blueprint`: si hay `dataProfile`, incluirlo como contexto adicional en la llamada al pipeline de patrones (variables reales, entidades, cobertura)
- `generate_rags`: si hay archivos en `client_data_files`, inyectar los contenidos como chunks iniciales del RAG (función `injectClientDataAsChunks`)

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| SQL migration | Tabla `client_data_files` + bucket `project-data` |
| `supabase/functions/analyze-client-data/index.ts` | Nueva edge function |
| `src/components/projects/wizard/ProjectDataSnapshot.tsx` | Nuevo componente UI |
| `src/pages/ProjectWizard.tsx` | Lógica condicional Step 7 |
| `src/hooks/useProjectWizard.ts` | Estado dataProfile, pasar a stepData |
| `src/config/projectPipelinePrompts.ts` | Bloques condicionales data_profile |
| `supabase/functions/project-wizard-step/index.ts` | Recibir dataProfile, pasar a prompts, inyectar en patrones/RAG |
| `supabase/config.toml` | Config para `analyze-client-data` |

### Orden de implementación

1. SQL migration (tabla + bucket)
2. Edge function `analyze-client-data`
3. Componente `ProjectDataSnapshot`
4. Integración en wizard (hook + page)
5. Inyección en prompts del PRD
6. Inyección en pattern blueprint y RAG

