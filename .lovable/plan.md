
Objetivo
- Extender el historial del proyecto para que:
  1) permita adjuntar archivos en cada actividad,
  2) analice automáticamente el texto de la actividad + adjuntos,
  3) mantenga un resumen amplio y vivo del estado del proyecto,
  4) use ese contexto para futuras regeneraciones (alcance, PRD, etc.).

Estado actual detectado (base existente)
- Ya existe `ProjectActivityTimeline` con alta manual de eventos y auto-registro al aprobar pasos.
- Ya existe bucket `project-documents` y patrones de subida de archivos.
- Ya existe pipeline IA en `project-wizard-step` (Gemini/Claude) y contexto de pasos.
- Falta: adjuntos por actividad, análisis IA del historial, y resumen consolidado persistente/actualizable.

Plan de implementación

1) Base de datos (migración)
- Crear tabla `business_project_timeline_attachments`:
  - `id`, `timeline_id`, `project_id`, `file_name`, `storage_path`, `mime_type`, `size_bytes`,
  - `extracted_text`, `analysis_json`, `created_at`, `user_id`.
- Crear tabla `business_project_live_summary` (1 fila por proyecto):
  - `project_id` (PK), `summary_markdown`, `status_json`, `last_event_id`, `last_event_at`, `updated_at`, `model_used`.
- Añadir en `business_project_timeline` columnas para inteligencia:
  - `analysis_json`, `impact_scope`, `impact_prd`, `needs_regeneration`, `importance_score`.
- Índices por `project_id`, `event_date desc`, `last_event_at`.
- RLS:
  - lectura para owner + shared access;
  - escritura/actualización solo owner + shared edit access.
- Nota técnica: no editar manualmente `src/integrations/supabase/types.ts` (se regenera desde esquema).

2) Edge Function de inteligencia de actividad (nueva)
- Crear `supabase/functions/project-activity-intelligence/index.ts` con acciones:
  - `analyze_entry`: analiza una actividad concreta + adjuntos.
  - `refresh_summary`: recalcula resumen global del proyecto desde historial + pasos del wizard.
  - `get_summary`: devuelve resumen actual.
- Flujo IA:
  - Leer actividad + adjuntos (`extracted_text`).
  - Generar JSON estructurado: decisiones, feedback cliente, riesgos, bloqueos, cambios de alcance, impacto en PRD/Scope.
  - Persistir `analysis_json` en entrada.
  - Recalcular `business_project_live_summary` (resumen amplio, estado actual, próximos pasos, alertas).
- Usar el stack IA ya existente del proyecto (Gemini/Claude en backend), con manejo explícito de errores y timeout.

3) Frontend: Timeline con adjuntos
- Extender `ProjectActivityTimeline.tsx`:
  - Subida múltiple de archivos por actividad (PDF, DOCX, XLSX, CSV, TXT, JSON, audio).
  - Guardar metadata de adjuntos por evento.
  - Mostrar chips/listado de adjuntos por entrada.
  - Tras guardar actividad: llamar `analyze_entry`; al terminar, refrescar resumen.
- Extracción de texto de adjuntos:
  - Reusar utilidades existentes para PDF/DOCX/texto.
  - Para audio, reutilizar `speech-to-text`.
  - Persistir texto extraído para análisis posterior.

4) Frontend: Resumen vivo del proyecto (nuevo panel)
- Crear `ProjectLiveSummaryPanel.tsx` en el wizard:
  - Bloques: “Punto actual”, “Cambios recientes”, “Riesgos/Bloqueos”, “Implicaciones sobre Scope/PRD”, “Siguientes acciones”.
  - Botón “Recalcular resumen”.
  - Auto-refresh y suscripción realtime.
- Integrarlo en `ProjectWizard.tsx` encima del timeline.

5) Integración con el flujo del wizard
- En `useProjectWizard.ts`:
  - después de auto-log de `approveStep`, disparar `refresh_summary`.
  - opcionalmente auto-log también en eventos clave de generación/regeneración (extract, scope, PRD, etc.) para trazabilidad completa.
- En llamadas de generación (`generate_scope`, `generate_prd`, genéricos):
  - incluir `project_activity_context` (resumen vivo + últimos cambios críticos) para que el modelo “esté al tanto” al regenerar documentos.

Diagrama de flujo (alto nivel)
```text
Actividad manual + adjuntos
        │
        ├─> guardar timeline + attachments
        │
        ├─> analyze_entry (IA)
        │      ├─ analiza texto actividad
        │      ├─ analiza texto extraído adjuntos
        │      └─ guarda analysis_json
        │
        └─> refresh_summary (IA)
               ├─ consolida historial + estado wizard
               └─ actualiza business_project_live_summary
                           │
                           └─ UI muestra resumen vivo + contexto para nuevas generaciones
```

Criterios de aceptación
- Se puede crear actividad con 1..N adjuntos y verlos en el historial.
- Cada nueva actividad actualiza automáticamente el resumen vivo.
- El resumen refleja feedback cliente, cambios, riesgos y próximos pasos.
- Al regenerar Scope/PRD, el contexto del historial se usa explícitamente.
- Varios agentes ven cambios sin recargar (realtime/polling robusto).

Archivos previstos
- Nuevo: `supabase/functions/project-activity-intelligence/index.ts`
- Nuevo: `src/components/projects/wizard/ProjectLiveSummaryPanel.tsx`
- Editar: `src/components/projects/wizard/ProjectActivityTimeline.tsx`
- Editar: `src/hooks/useProjectWizard.ts`
- Editar: `supabase/functions/project-wizard-step/index.ts` (inyectar contexto vivo en prompts)
- Nuevo: migración SQL para tablas/columnas/índices/RLS de adjuntos + resumen vivo
