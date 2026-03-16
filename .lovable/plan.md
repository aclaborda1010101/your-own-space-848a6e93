

## Plan: Monitorización granular del progreso de generación PRD

### Problema actual
Cuando se genera un PRD, el usuario solo ve 3 fases genéricas (Alcance, Auditoría, PRD) sin saber en qué sub-parte está la generación ni cuánto falta. La edge function ya loguea "Part 1/6 done", "Part 2/6 done", etc., pero esa info no llega al frontend.

### Solución: Persistir progreso granular en DB y mostrarlo en tiempo real

**1. Tabla de progreso temporal** (o campo en `project_wizard_steps`)

Usar un campo `input_data` del step 3 (o una fila auxiliar) para persistir el progreso sub-parte. Alternativa más limpia: escribir en `project_wizard_steps.input_data` del step 3 un JSON con el progreso actual:

```json
{
  "generation_progress": {
    "current_part": 4,
    "total_parts": 6,
    "parts_completed": ["Part 1", "Part 2", "Part 3"],
    "current_label": "Scoring, SQL, Integrations",
    "started_at": "2026-03-16T10:00:00Z",
    "last_update": "2026-03-16T10:03:30Z"
  }
}
```

**2. Edge function: escribir progreso tras cada Part** (`supabase/functions/project-wizard-step/index.ts`)

Después de cada `console.log("[PRD] Part X done...")`, hacer un update ligero:
```typescript
await supabase.from("project_wizard_steps")
  .update({ input_data: { generation_progress: { current_part: X, total_parts: 6, ... } } })
  .eq("project_id", projectId)
  .eq("step_number", 3);
```

Son ~6 updates adicionales (uno por parte), impacto mínimo.

**3. Frontend: polling mejorado con sub-parte** (`src/hooks/useProjectWizard.ts`)

En el loop de polling existente (cada 6s), leer también `input_data` del step 3 para extraer `generation_progress` y exponer un nuevo estado:
```typescript
const [prdSubProgress, setPrdSubProgress] = useState<{ currentPart: number; totalParts: number; label: string; startedAt: string } | null>(null);
```

**4. UI mejorada** (`src/components/projects/wizard/ChainedPRDProgress.tsx`)

Expandir el componente para mostrar dentro de la fase "PRD":
- Barra de progreso (Part X/6)
- Label de la sub-parte actual ("Scoring, SQL, Integrations...")
- Tiempo transcurrido
- ETA estimado basado en tiempo medio por parte

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/project-wizard-step/index.ts` | Añadir ~6 updates de progreso tras cada Part completada |
| `src/hooks/useProjectWizard.ts` | Leer `input_data.generation_progress` en el polling loop, exponer `prdSubProgress` |
| `src/components/projects/wizard/ChainedPRDProgress.tsx` | Mostrar barra de progreso sub-parte, tiempo transcurrido, ETA |
| `src/pages/ProjectWizard.tsx` | Pasar `prdSubProgress` al componente |

### Resultado
El usuario verá en tiempo real: "Generando PRD Técnico — Parte 4/6: Scoring, SQL, Integrations — 3:24 transcurrido — ~2 min restantes"

