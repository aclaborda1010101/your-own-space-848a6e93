

## Plan: Calibración del Scoring para Auditoría IA

Preparar el sistema para calibrar scores con datos reales: tabla de ground truth, vistas SQL de metricas, y dashboard interno de calibracion.

---

### 1. SQL Migration

Crear tabla `bl_diagnostics_labels` + 2 vistas SQL + RLS:

```sql
-- Ground truth labels
CREATE TABLE bl_diagnostics_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid REFERENCES bl_diagnostics(id) ON DELETE CASCADE NOT NULL,
  digital_maturity_label text CHECK (... IN ('baja','media','alta')),
  ai_opportunity_label text CHECK (...),
  automation_level_label text CHECK (...),
  data_readiness_label text CHECK (...),
  recommendation_correct boolean,
  notes text,
  labeled_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- RLS: solo usuarios que poseen la auditoría
-- Vista bl_calibration_metrics: totales, promedios, error medio por score, % prioridad correcta
-- Vista bl_score_distribution: distribución por buckets (0-24, 25-49, 50-74, 75-100) para cada score
```

Normalizacion de labels: baja=0, media=50, alta=100. Error = |score_modelo - score_label|.

---

### 2. Nueva pagina `src/pages/CalibrationDashboard.tsx`

Dashboard interno (ruta `/calibracion-scoring`) con:

- Banner de regla de operacion: "Primeras 100 auditorías: NO cambiar pesos. Solo observar."
- 4 KPI cards: total auditorias, etiquetadas, % etiquetado, % prioridad correcta
- Card de error medio por score con badges color (verde <15, ambar 15-25, rojo >25)
- Chart de distribucion de AI Opportunity (BarChart con 4 buckets coloreados)
- Seccion de etiquetado: selector de auditoria, muestra scores actuales, formulario para asignar labels (baja/media/alta) a cada score + switch de recomendacion correcta + notas

---

### 3. Ruta en `src/App.tsx`

- Lazy import de `CalibrationDashboard`
- Ruta protegida: `/calibracion-scoring`

---

### Verificacion de instrumentacion

Ya verificado: `bl_diagnostics` tiene los 4 scores, `priority_recommendation`, `created_at`, y `audit_id` que linkea a `bl_audits` con `sector` y `business_size`. El dataset historico ya se genera automaticamente con cada auditoria.

---

### Tareas

1. Migration SQL: tabla labels + 2 vistas + RLS
2. Crear pagina CalibrationDashboard con metricas, charts y formulario de etiquetado
3. Agregar ruta protegida en App.tsx

