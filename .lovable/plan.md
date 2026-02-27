

## Plan: Aplicar prompts afinados del pipeline JARVIS (Fases 2-9)

El documento sube significativamente la calidad de los prompts existentes (Fases 2-3) y añade los prompts de Fases 4-9 que aún no estaban implementados.

### Cambios

**1. Actualizar `src/config/projectPipelinePrompts.ts`** — Reescritura completa:
- **Fase 2**: Nuevo system prompt (analista senior, 15 años), nuevo JSON schema mucho más rico (añade `decisiones_confirmadas`, `decisiones_pendientes`, `datos_cuantitativos`, `alertas`, `integraciones_identificadas`, `confianza_extracción`, stakeholders con `dolor_principal` y `poder_decisión`, objetivos con `prioridad` P0/P1/P2)
- **Fase 3**: Nuevo system prompt (más exigente, "regla de oro"), estructura expandida de 9 a 12 secciones (añade Stakeholders, Arquitectura técnica, Integraciones, Decisiones técnicas, Condiciones, vinculación costes-fases)
- **Fases 4-9**: Añadir prompts completos para Auditoría Cruzada, Documento Final, AI Leverage, PRD Técnico, Generación de RAGs, Detección de Patrones
- Actualizar `STEP_MODELS` para reflejar modelos de todas las fases

**2. Actualizar `supabase/functions/project-wizard-step/index.ts`** — Fases 2 y 3 activas:
- **Fase 2 (extract)**: Reemplazar system prompt y user prompt inline con los afinados. Cambiar `temperature: 0.3 → 0.2`, `maxOutputTokens: 8192 → 16384`
- **Fase 3 (generate_scope)**: Reemplazar system prompt y user prompt inline con los afinados. Cambiar `temperature: 0.5 → 0.4`, `max_tokens: 8192 → 16384`, estructura de 9 → 12 secciones

**3. Actualizar UI `ProjectWizardStep2.tsx`** — Adaptar campos editables al nuevo schema:
- El briefing ahora tiene campos nuevos (`decisiones_confirmadas`, `datos_cuantitativos`, `alertas`, etc.) que el componente de edición debe mostrar
- Los `objetivos` pasan de ser strings a objetos `{objetivo, prioridad, métrica_éxito}`
- Los `stakeholders` tienen campos adicionales (`dolor_principal`, `poder_decisión`)

**4. Desplegar** `project-wizard-step` para activar los prompts actualizados

### Nota
Las Fases 4-9 se añaden solo como prompts en `projectPipelinePrompts.ts`. La lógica de ejecución en la Edge Function (actions para `audit`, `final_doc`, `ai_leverage`, `prd`, `rags`, `patterns`) se implementará en sprints futuros — este cambio prepara los prompts para cuando se activen.

