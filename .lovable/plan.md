
Objetivo
- Endurecer los prompts de Fase 4 y Fase 5 para forzar detección de inconsistencia MVP (OCR en Fase 1) y forzar Fase 0/PoC cuando exista gap de precio >50%.

Implementación
1) Actualizar Fase 4 (auditoría) en ambos sitios:
- `src/config/projectPipelinePrompts.ts` → `AUDIT_SYSTEM_PROMPT`
- `supabase/functions/project-wizard-step/index.ts` → `systemPrompt` de `run_audit`
- Añadir regla textual obligatoria:
  - “REGLA ESPECÍFICA MVP: Si en el material fuente el proveedor propuso una funcionalidad como PRIMERA DEMOSTRACIÓN DE VALOR (ej: demo OCR), esa funcionalidad DEBE estar en Fase 1; si el documento pone ‘sin OCR’ en Fase 1, marcar como INCONSISTENCIA CRÍTICA.”

2) Actualizar Fase 5 (documento final) en ambos sitios:
- `src/config/projectPipelinePrompts.ts` → `FINAL_DOC_SYSTEM_PROMPT`
- `supabase/functions/project-wizard-step/index.ts` → `systemPrompt` de `generate_final_doc`
- Añadir regla obligatoria directiva:
  - “Si gap >50% entre expectativa cliente y presupuesto real, DEBES crear Fase 0/PoC como primera fase del plan con: duración 2-3 semanas, coste entre expectativa cliente y 5.000€, entregables (demo core + maquetas), criterio de paso a fases 1-3 tras validación cliente.”

3) Reforzar instrucción operativa en prompt de usuario de Fase 5 (recomendado para máxima adherencia):
- `buildFinalDocPrompt` (config) y `userPrompt` inline de `generate_final_doc` (edge)
- Añadir una instrucción explícita: “Si detectas gap >50%, incluye obligatoriamente Fase 0/PoC al inicio del plan con esos 4 campos”.

4) Mantener sincronía de prompts duplicados:
- Verificar que el texto de reglas F4/F5 sea equivalente entre `src/config/...` y `supabase/functions/...` para evitar deriva entre UI/config y runtime real.

5) Deploy y verificación
- Redeploy de `project-wizard-step`.
- Ejecutar prueba end-to-end en el proyecto actual:
  - Re-ejecutar Fase 4 y confirmar hallazgo “INCONSISTENCIA CRÍTICA” cuando Fase 1 diga “sin OCR” pero el material pida demo OCR primero.
  - Re-ejecutar Fase 5 y confirmar que el documento final inserta “Fase 0/PoC” como primera fase con duración, coste, entregables y criterio de continuidad.

Detalles técnicos
- Archivos a tocar:
  - `src/config/projectPipelinePrompts.ts`
  - `supabase/functions/project-wizard-step/index.ts`
- No requiere cambios de esquema DB ni UI.
- Cambio centrado en prompt engineering + consistencia runtime.
