

# Economic Backtesting Engine + Error Intelligence + Validation Plans

## Resumen

4 bloques que transforman el backtesting tecnico en impacto economico medible, generan roadmaps de mejora automaticos desde cada fallo, y convierten hipotesis no confirmadas en decisiones de inversion concretas.

---

## BLOQUE 1 -- Nueva tabla SQL: `economic_backtests`

Se crea 1 tabla nueva con RLS. Las FK apuntan a `model_backtests` y `pattern_detector_runs` (que tiene `user_id`).

Columnas:
- `id`, `backtest_id` (FK a `model_backtests`), `run_id` (FK a `pattern_detector_runs`), `user_id`
- `period_start`, `period_end`
- Metricas economicas: `gross_revenue_protected`, `capital_tied_up_cost`, `unprevented_losses`, `net_economic_impact`
- ROI: `roi_multiplier`, `payback_period_days`
- Factores opcionales: `loyalty_bonus_included` (default false), `reputational_damage_included` (default false)
- Parametros: `margin_used_pct` (default 30), `cost_of_capital_pct` (default 5)
- Escalado: `per_pharmacy_impact`, `total_pharmacies` (default 3800)
- `calculation_method` (ai_estimation o code_execution)
- `assumptions` (JSONB), `event_breakdown` (JSONB), `error_intelligence` (JSONB)
- RLS: `auth.uid() = user_id`

---

## BLOQUE 2 -- Economic Backtesting Engine (edge function)

### Nueva funcion `executeEconomicBacktesting(runId, userId)` en `pattern-detector-pipeline/index.ts`

Se ejecuta automaticamente despues de Phase 6 (backtesting tecnico) y antes de Phase 7.

Pipeline modificado:
```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Credibility Engine -> Phase 6 -> Economic Backtesting -> Phase 7
```

Logica:
1. Lee el backtest tecnico de `model_backtests` para el run
2. Lee las senales de `signal_registry` y la credibility matrix
3. Pide a la IA que calcule para cada caso retrospectivo:
   - Aciertos (True Positive): venta salvada = unidades x precio medio x margen (30% por defecto)
   - Falsas alarmas (False Positive): coste capital inmovilizado = valor stock x 5% anual x dias / 365. Merma (20%) solo si caducidad corta
   - Fallos no detectados (False Negative): venta perdida = demanda no servida x precio x margen
4. Calcula NEI = ingresos protegidos - coste falsas alarmas - perdidas no prevenidas
5. Calcula ROI multiplicador y payback period
6. Para cada false negative, genera `error_intelligence` con: root_cause, proposed_new_sources, integration_cost, expected_uplift, priority_score
7. Para cada senal con status "moved_to_hypothesis", genera plan de validacion
8. Inserta en `economic_backtests`
9. Almacena resumen en `phase_results.economic_backtesting`

### Factores opcionales (desactivados por defecto)
- Bonus fidelizacion (+15% sobre aciertos): solo si `loyalty_bonus_included = true`
- Dano reputacional: solo si `reputational_damage_included = true`
- El usuario puede activarlos, pero el numero base es conservador e incontestable

### Reglas de transparencia
- Cada euro debe ser trazable al evento que lo genera
- Si no hay margenes reales del cliente, usar 30% para farmacia
- Todos los calculos marcados como "ai_estimation"
- Mostrar siempre: desglose por evento, unitario por farmacia, total red (x3.800)

---

## BLOQUE 3 -- Phase 7 ampliada

Modificar el prompt de Phase 7 para incluir:
- Datos del economic backtesting en el contexto
- Instruccion de generar bloque `economic_backtesting` en el dashboard_output
- Instruccion de generar `validation_plans` para hipotesis no confirmadas: que datos se necesitan, donde conseguirlos, impacto estimado, coste de integracion, decision recomendada

El `dashboard_output` final incluira:
- Bloque existente `credibility_engine`
- Bloque existente `learning_metrics`
- Nuevo bloque `economic_backtesting` con NEI, ROI, event_breakdown, error_intelligence

---

## BLOQUE 4 -- UI: nuevo sub-tab "Impacto Economico" en backtesting

### Modificacion de `PatternDetector.tsx`

Anadir contenido al tab "Backtesting" existente (no crear un tab nuevo):

Despues de las metricas tecnicas existentes, mostrar una seccion "IMPACTO ECONOMICO":
- 4 cards: Ingresos Protegidos, Coste Falsas Alarmas, Perdidas No Prevenidas, Impacto Neto
- Card de ROI: "Por cada EUR 1 invertido, EUR X de retorno" + payback period
- Desglose unitario: "Por farmacia: EUR X/mes" y "Total red (x3.800): EUR X/mes"
- Tabla de eventos con impacto en euros (event_breakdown)
- Seccion "Oportunidades de Mejora" (error_intelligence): cada fallo con root_cause, fuentes propuestas, coste/uplift/prioridad
- Seccion "Planes de Validacion": hipotesis no confirmadas con datos necesarios y decision recomendada
- Toggle para activar/desactivar bonus fidelizacion y dano reputacional (solo visual, los numeros se recalcularian en un re-run)
- Disclaimer: "Estimaciones de IA — margen conservador del 30%"

### Modificacion de `usePatternDetector.tsx`

- Nueva interfaz `EconomicBacktest` con todos los campos de la tabla
- Nuevo estado `economicBacktests`
- Fetch de `economic_backtests` para el run actual en `loadRunData`

---

## Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | 1 tabla nueva `economic_backtests` + indices + RLS |
| `supabase/functions/pattern-detector-pipeline/index.ts` | Nueva funcion `executeEconomicBacktesting`, insertar entre Phase 6 y Phase 7, ampliar prompt Phase 7 |
| `src/hooks/usePatternDetector.tsx` | Nueva interfaz y estado para economic backtests |
| `src/components/projects/PatternDetector.tsx` | Seccion de impacto economico dentro del tab Backtesting |

## Orden de implementacion

1. Migracion SQL (tabla economic_backtests)
2. Edge function: executeEconomicBacktesting + modificar run_all + ampliar Phase 7
3. Hook: nuevo fetch
4. UI: seccion de impacto economico

## Resultado esperado

- Cada backtesting tecnico se traduce automaticamente en euros
- Desglose por evento: aciertos = venta salvada, falsas alarmas = capital inmovilizado, fallos = venta perdida
- ROI multiplicador y payback period calculados
- Cada fallo genera un roadmap de mejora con fuentes propuestas y priorizacion
- Hipotesis no confirmadas se convierten en decisiones de inversion concretas
- Factores de fidelizacion y reputacion disponibles pero desactivados por defecto
- Numero base conservador e incontestable (margen 30%, sin bonus)
- Transparencia total: el cliente ve de donde sale cada euro

