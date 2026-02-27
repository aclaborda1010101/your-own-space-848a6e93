

## Sprint 1: Pipeline de Proyectos — Wizard de 9 pasos (pasos 1-3 + costes)

### Situación actual

- Existe `business_projects` como tabla CRM de pipeline comercial (estado, valor, contactos, timeline)
- Existe `project_pipelines` + `pipeline_steps` como pipeline de análisis de ideas (4-5 pasos multi-modelo)
- La tabla `projects` ya existe pero es de **films/screenwriting** — no se puede reutilizar
- Edge functions `project-pipeline-step` e `idea-pipeline-step` ya manejan multi-modelo

### Decisión arquitectónica clave

El nuevo wizard **extiende** `business_projects` (no crea tabla `projects` nueva, que ya existe para films). Añadimos campos `current_step`, `input_type`, `input_content`, `project_type` a `business_projects` y creamos las tablas auxiliares (`project_steps`, `project_documents`, `project_costs`).

---

### Plan de implementación

**Task 1: Migración SQL — Nuevas tablas y columnas**
- Añadir a `business_projects`: `current_step INT DEFAULT 0`, `input_type TEXT`, `input_content TEXT`, `project_type TEXT DEFAULT 'mixto'`
- Crear `project_wizard_steps` (evitar conflicto con `pipeline_steps`): id, project_id → business_projects, step_number, step_name, status, input_data JSONB, output_data JSONB, model_used, version, approved_at, timestamps
- Crear `project_documents`: id, project_id, step_number, version, content, format, timestamps
- Crear `project_costs`: id, project_id, step_number, service, operation, tokens_input, tokens_output, api_calls, cost_usd NUMERIC(10,6), metadata JSONB, timestamps
- RLS policies para user_id ownership
- Índices en project_costs y project_wizard_steps

**Task 2: Configuración de prompts y tarifas**
- Crear `src/config/projectPipelinePrompts.ts` con los prompts de extracción (paso 2) y generación de alcance (paso 3)
- Crear `src/config/projectCostRates.ts` con RATES y `calculateCost()` function

**Task 3: Edge function `project-wizard-step`**
- Action `extract` (paso 2): llama a Gemini Flash con el prompt de extracción, devuelve JSON estructurado del briefing, registra coste
- Action `generate_scope` (paso 3): llama a Claude Sonnet con el prompt de generación de documento de alcance, registra coste
- Action `transcribe` (paso 2): reutiliza `speech-to-text` existente para audio, registra coste de Whisper
- Registra cada llamada en `project_costs`

**Task 4: Hook `useProjectWizard`**
- Estado del wizard: currentStep, stepStatuses, projectData
- CRUD: createWizardProject, saveStep, approveStep, navigateToStep
- Llamadas a edge function para pasos 2 y 3
- Polling/status refresh para generación async
- Autosave cada 30s en campos editables
- Cálculo y query de costes acumulados

**Task 5: Componentes del Wizard UI**
- `ProjectWizardStepper`: sidebar vertical con 9 pasos, ✅/🔒/activo, clickable para completados
- `ProjectWizardStep1`: formulario de entrada (nombre, empresa, contacto, necesidad, tipo, upload audio/doc/texto)
- `ProjectWizardStep2`: vista dividida (material original | briefing editable inline), campos pendientes en amarillo, botones regenerar/aprobar
- `ProjectWizardStep3`: editor markdown con preview, streaming del texto, índice lateral clickable, botones regenerar sección/todo, exportar PDF/MD, aprobar
- `ProjectCostBadge`: badge flotante €X.XX con panel desplegable de desglose por paso y servicio

**Task 6: Integración en página Projects**
- Botón "Nuevo Proyecto Wizard" que abre vista wizard (diferente del create dialog actual)
- Ruta `/projects/wizard/:id` para el wizard
- En la lista de proyectos: columna de coste y paso actual para proyectos wizard
- El wizard existente de crear proyecto rápido sigue funcionando

### Notas técnicas
- Los prompts van en archivo de config separado, no hardcodeados
- Paso 3 usa streaming (Claude Sonnet)
- Cada output se guarda con versionado (si regenera → version 2)
- Responsive/mobile
- Pasos 4-9 aparecen bloqueados con 🔒 en el stepper
- Sprint 2 contract (AuditFinding type) se documenta como comentario en el código

