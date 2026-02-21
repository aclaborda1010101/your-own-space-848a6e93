

# Pattern Intelligence v5: Signal Credibility Engine + Aprendizaje Continuo

## Alcance

4 bloques de funcionalidad nueva que transforman el detector de patrones de "detector puntual" a "sistema que aprende y mejora con cada prediccion".

---

## BLOQUE 1 -- Nuevas tablas SQL (3 tablas)

Se crean 3 tablas con RLS. Se corrige el SQL propuesto por el usuario: las FK apuntan a `pattern_detector_runs` (no a `projects`, que usa `owner_id` en vez de `user_id`).

### Tabla 1: `prediction_log`

Registra cada prediccion y su resultado real para el loop de aprendizaje.

- `id`, `run_id` (FK a `pattern_detector_runs`), `user_id`
- `prediction_date`, `target_medication`, `target_pharmacy`
- `predicted_outcome`, `predicted_confidence`
- `actual_outcome`, `was_correct`
- `error_analysis`, `missing_signal`, `lesson_learned`
- `model_version`, `regime_flag` (enum: normal, demand_shock, supply_shock, regulatory_change, unknown_anomaly)
- `signals_used` (JSONB)
- RLS: `auth.uid() = user_id`

### Tabla 2: `pattern_discovery_log`

Registra patrones descubiertos en cualquiera de los 3 modos.

- `id`, `run_id` (FK a `pattern_detector_runs`), `user_id`
- `discovery_mode` (theoretical, data_driven, error_analysis)
- `pattern_description`, `variables_involved` (JSONB)
- `correlation_strength`, `p_value`
- `validated`, `validation_result`
- RLS: `auth.uid() = user_id`

### Tabla 3: `signal_credibility_matrix`

Motor de credibilidad con los 4 pilares.

- `id`, `signal_id` (FK a `signal_registry`), `pattern_id` (FK a `pattern_discovery_log`, nullable)
- `run_id` (FK a `pattern_detector_runs`), `user_id`
- Los 4 scores: `temporal_stability_score`, `cross_replication_score`, `anticipation_days`, `signal_to_noise_ratio`
- `final_credibility_score` (calculado con pesos fijos 0.30/0.25/0.25/0.20)
- `signal_class` (Alpha, Beta, Fragile, Noise)
- `regime_flag`
- `weights_version` (default 1, solo cambia en revision trimestral)
- RLS: `auth.uid() = user_id`

---

## BLOQUE 2 -- Signal Credibility Engine (edge function)

### Cambios en `pattern-detector-pipeline/index.ts`

**Nueva funcion `executeCredibilityEngine(runId, userId)`** que se ejecuta despues de Phase 5 (deteccion de patrones) y antes de Phase 6 (backtesting).

Logica:
1. Lee todas las senales de `signal_registry` para el run
2. Para cada senal, calcula los 4 scores (en Modo 1/teorico, usa estimaciones de la IA):
   - Estabilidad temporal: evaluada por la IA basandose en el tipo de patron
   - Replicabilidad cruzada: evaluada segun si el patron es especifico de una farmacia o generalizable
   - Capacidad de anticipacion: basada en `avg_anticipation_days` del patron
   - Ratio senal/ruido: basada en confianza y p_value del patron
3. Calcula `final_credibility_score = 0.30*estabilidad + 0.25*replicabilidad + 0.25*anticipacion + 0.20*senal_ruido`
4. Clasifica: >=0.8 Alpha, 0.6-0.79 Beta, 0.4-0.59 Fragile, <0.4 Noise
5. Inserta en `signal_credibility_matrix`
6. Registra cada patron descubierto en `pattern_discovery_log` con `discovery_mode = 'theoretical'`

**Regime detection**: Se anade a Phase 5. El prompt de deteccion de patrones incluye instruccion de evaluar el regimen de mercado actual. El resultado se guarda en las senales y en la credibility matrix.

**Modificacion de `run_all`**: Insertar credibility engine entre Phase 5 y Phase 6:
```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Credibility Engine -> Phase 6 -> Phase 7
```

---

## BLOQUE 3 -- Loop de aprendizaje (logica preparatoria)

En Phase 7 (hipotesis accionables), se anade al prompt:

- Instruccion de generar `learning_metrics` con el JSON de metricas de obsesion
- Cada hipotesis incluye `regime_flag` y `validation_method`
- Se genera un bloque `credibility_engine` en el dashboard_output con los contadores

El loop real de "Predecir -> Comparar -> Analizar errores" se activa cuando haya datos del usuario (Modo 2). Por ahora se prepara la infraestructura:
- Las tablas existen
- Phase 7 genera las metricas iniciales (con valores en 0 para las que requieren datos reales)
- El dashboard muestra las metricas

---

## BLOQUE 4 -- UI del dashboard

### Nuevo tab "Credibilidad" en `PatternDetector.tsx`

Se anade un 6o tab al `TabsList`:

```text
Fuentes | Quality Gate | Analisis | Credibilidad | Datasets | Backtesting
```

Contenido del tab:
- 4 cards de resumen: Senales Alpha, Beta, Fragiles, Ruido filtrado
- Tabla de senales con su clase (color-coded: verde/amarillo/naranja/rojo)
- Seccion de metricas de aprendizaje (% acierto, evolucion, patrones descubiertos)
- Badge de regimen detectado (normal, demand_shock, etc.)
- Indicador "Distancia al optimo"

### Modificacion del hook `usePatternDetector.tsx`

- Nuevo estado `credibility: CredibilityData[]`
- Fetch de `signal_credibility_matrix` para el run actual
- Fetch de `pattern_discovery_log` para el run actual

---

## Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | 3 tablas nuevas + indices + RLS |
| `supabase/functions/pattern-detector-pipeline/index.ts` | Nueva funcion credibility engine, regime detection en Phase 5, metricas en Phase 7, modificacion de run_all |
| `src/hooks/usePatternDetector.tsx` | Nuevos estados e interfaces para credibility y discoveries |
| `src/components/projects/PatternDetector.tsx` | Nuevo tab "Credibilidad" con metricas, tabla de senales clasificadas, y badge de regimen |

## Orden de implementacion

1. Migracion SQL (3 tablas)
2. Edge function: credibility engine + regime detection + metricas Phase 7
3. Hook: nuevos fetches
4. UI: tab de credibilidad

## Resultado esperado

- Toda senal descubierta pasa por tortura estadistica y se clasifica como Alpha/Beta/Fragile/Noise
- Cada senal y prediccion lleva un flag de regimen de mercado
- Dashboard muestra contadores de senales por clase, metricas de aprendizaje, y regimen detectado
- Infraestructura de prediction_log y pattern_discovery_log lista para activar el loop completo cuando lleguen datos reales del cliente
- Los pesos del credibility score son FIJOS (0.30/0.25/0.25/0.20), solo modificables manualmente

