

## Diagnóstico

El problema es claro: el prompt del backend (edge function) fue actualizado al esquema v3 con campos como `project_summary`, `observed_facts`, `inferred_needs`, `solution_candidates`, etc., pero **el componente frontend `ProjectWizardStep2.tsx` sigue renderizando el esquema antiguo** con campos como `resumen_ejecutivo`, `necesidad_principal`, `objetivos`, `problemas_detectados`, `decisiones_confirmadas`, `stakeholders`, `nivel_complejidad`, etc.

Resultado: el modelo genera datos correctos en el nuevo formato, pero la UI no encuentra ninguno de los campos antiguos y muestra todo vacío.

## Plan

### 1. Actualizar `ProjectWizardStep2.tsx` para renderizar el esquema v3

Reemplazar las secciones de renderizado del briefing para mapear los nuevos bloques:

| Sección antigua | Nuevo bloque v3 |
|---|---|
| `resumen_ejecutivo` + `necesidad_principal` | `project_summary` (title, context, primary_goal) |
| `nivel_complejidad` / `urgencia` | `project_summary.complexity_level` / `urgency_level` |
| `objetivos` + `problemas_detectados` | `observed_facts` (cada item con id, title, description, certainty, evidence_snippets) |
| `decisiones_confirmadas` / `decisiones_pendientes` | Se distribuyen entre `observed_facts` (confirmed) y `open_questions` |
| `stakeholders` / `integraciones` / `datos_cuantitativos` | Items dentro de `observed_facts` con `likely_layer` y badges |
| (nuevo) | `inferred_needs` — necesidades deducidas |
| (nuevo) | `solution_candidates` — hipótesis con certeza y capa |
| `alertas` / `datos_faltantes` | `constraints_and_risks` + `open_questions` |
| (nuevo) | `architecture_signals` — señales con capa probable |
| (nuevo) | `extraction_warnings` — alertas de integridad |
| `alcance_preliminar` | Eliminado (no pertenece a esta capa) |

### 2. Renderizado por item con metadatos

Cada item en los bloques mostrará:
- **Title** + **description**
- Badges: `certainty` (high/medium/low), `abstraction_level`, `likely_layer`
- `evidence_snippets` colapsables
- `candidate_component_type` si no es "none"

### 3. Barra de estado actualizada

Reemplazar `nivel_complejidad`/`urgencia` por `project_summary.complexity_level`/`project_summary.urgency_level`.

### 4. Retrocompatibilidad

Añadir detección del formato: si existe `project_summary` → renderizar v3; si existe `resumen_ejecutivo` → renderizar legacy. Esto evita romper briefings ya generados.

### Archivos a modificar

- `src/components/projects/wizard/ProjectWizardStep2.tsx` — reescribir la zona de renderizado del briefing (líneas ~330-695)

