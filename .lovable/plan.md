

# JARVIS OS v4.0 — Plan de Implementacion por Fases

Este documento describe un sistema completo con 3 modulos nuevos. Dado el volumen, se divide en 4 fases incrementales. Cada fase es funcional por si sola.

---

## Estado Actual vs Requerido

**Ya existe:**
- `business_projects` (pipeline CRM con contactos, timeline, tareas)
- Pattern Intelligence completo (7 fases, Edge Function, UI, polling)
- Sidebar con Proyectos como grupo colapsable (Pipeline + Detector Patrones)

**Nuevo:**
- AI Business Leverage (cuestionario, diagnostico, recomendaciones, roadmap)
- Leads & Outreach (scoring, campanas, emails)
- Pricing por vertical

**Nota sobre tabla `projects`:** Ya existe una tabla `projects` para contenido audiovisual (con campos como `protagonist_count`, `vfx_complexity`). NO se puede reusar. Se usara `business_projects` como tabla central, anadiendo columnas necesarias (`sector`, `business_size`, `business_type`).

---

## FASE 1 — Schema + AI Business Leverage (Core)

### 1.1 Migracion SQL

Anadir columnas a `business_projects`:
- `sector TEXT`
- `business_size TEXT` (micro/small/medium/large)
- `business_type TEXT`
- `time_horizon TEXT`

Crear tablas nuevas:
- `questionnaire_templates` — plantillas de cuestionario por sector/tamano
- `questionnaire_responses` — respuestas vinculadas a proyecto
- `business_diagnostics` — scores y hallazgos del diagnostico
- `recommendations` — recomendaciones por capa con cuantificacion
- `roadmaps` — documento final generado
- `client_proposals` — propuestas enviadas a clientes

Todas con RLS via `business_projects.user_id`.

### 1.2 Edge Function: `ai-business-leverage`

Endpoint unico con acciones:
- `generate_questionnaire` — Genera cuestionario adaptado al sector/tamano
- `analyze_responses` — Procesa respuestas y genera diagnostico (scores, hallazgos, data gaps)
- `generate_recommendations` — Plan por capas con cuantificacion y priority score
- `generate_roadmap` — Documento final vendible en markdown

Cada accion guarda resultados en las tablas correspondientes.

### 1.3 UI: Tabs dentro del detalle de proyecto

Anadir tabs en `ProjectDetail` (src/pages/Projects.tsx):
- **Cuestionario** — Formulario dinamico generado por IA, con tipos de pregunta (single/multi/open/scale)
- **Radiografia** — 4 scores con progress bars + hallazgos criticos + data gaps
- **Plan por Capas** — 5 capas con recomendaciones ordenadas por priority score
- **Cuantificacion** — Tabla resumen de impacto por recomendacion
- **Roadmap** — Documento markdown renderizado, con boton "Exportar PDF"

### 1.4 Hook: `useBusinessLeverage`

Estado y mutaciones para cuestionarios, diagnosticos, recomendaciones y roadmaps vinculados a un proyecto.

---

## FASE 2 — Leads & Outreach

### 2.1 Tablas SQL

- `leads` — con lead_score, priority, recommended_action, estimated_tier_fit
- `lead_signals` — senales positivas/negativas con peso
- `outreach_campaigns` — campanas con metricas (sent, opened, replied)
- `outreach_emails` — emails por variante con estado y tracking

### 2.2 Edge Function: `ai-lead-scoring`

- Recibe datos del lead (sector, web, tamano, etc.)
- Calcula score 0-100 con senales ponderadas
- Genera 4 variantes de email personalizadas
- Sugiere accion recomendada y tier fit

### 2.3 Pagina: `/leads`

- Vista de leads con filtros por score/prioridad/sector
- Detalle de lead con senales, emails generados, historial
- Campanas con metricas agregadas

### 2.4 Sidebar

Anadir "Leads & Outreach" como item en el sidebar (icono Mail/Target).

---

## FASE 3 — Pricing por Vertical

### 3.1 Tabla SQL

- `pricing_tiers` — configuracion de pricing por sector y tier

### 3.2 UI en Settings

- Pagina/tab en Settings para configurar tiers por vertical
- Precarga con los datos de referencia del documento (peluquerias, clinicas, etc.)

### 3.3 Integracion con Roadmap

- El roadmap generado incluye pricing recomendado basado en la configuracion del usuario

---

## FASE 4 — Integracion End-to-End + Polish

- Flujo comercial completo: Lead -> Cuestionario -> Diagnostico -> Roadmap -> Propuesta
- Conversion de lead a proyecto con un click
- Dashboard cards con metricas de pipeline comercial
- Propuestas enviables (preview + estado)

---

## Detalles Tecnicos — FASE 1 (implementacion inmediata)

### Archivos nuevos:
- `supabase/functions/ai-business-leverage/index.ts`
- `src/hooks/useBusinessLeverage.tsx`
- `src/components/projects/BusinessLeverageTabs.tsx`
- `src/components/projects/QuestionnaireTab.tsx`
- `src/components/projects/DiagnosticTab.tsx`
- `src/components/projects/RecommendationsTab.tsx`
- `src/components/projects/RoadmapTab.tsx`

### Archivos modificados:
- `src/pages/Projects.tsx` — anadir tabs de Business Leverage al ProjectDetail
- Migracion SQL para nuevas tablas y columnas

### Flujo de datos:

```text
Usuario selecciona proyecto
  -> Tab "Cuestionario" -> genera preguntas via Edge Function
  -> Usuario responde -> guarda en questionnaire_responses
  -> Tab "Radiografia" -> invoca analyze_responses -> guarda en business_diagnostics
  -> Tab "Plan por Capas" -> invoca generate_recommendations -> guarda en recommendations
  -> Tab "Roadmap" -> invoca generate_roadmap -> guarda en roadmaps
  -> Boton "Crear Propuesta" -> guarda en client_proposals
```

### RLS Pattern:
Todas las tablas nuevas usan `project_id` que se valida contra `business_projects.user_id = auth.uid()` via subquery, igual que las tablas existentes de Pattern Intelligence.

---

## Recomendacion

Implementar Fase 1 primero (AI Business Leverage). Es el nucleo del valor comercial y el mas complejo. Las fases 2-4 son incrementales y dependen de la Fase 1.

Confirma si quieres proceder con la Fase 1 completa.

