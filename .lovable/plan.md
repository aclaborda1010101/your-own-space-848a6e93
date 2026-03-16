

## Plan: Reescribir `pipeline_run` con las 7 fases completas + Credibility Engine + Economic Backtesting

### Problema

El `pipeline_run` actual ejecuta solo 3 llamadas LLM (Phase 1 domain, Phase 2 sources, Phase 5 signals) con prompts reducidos. El standalone ejecuta 7 fases + Credibility Engine + Economic Backtesting con prompts mucho más ricos. El usuario quiere paridad total.

### Cambios

#### 1. `supabase/functions/_shared/ai-client.ts` — Nuevo alias de modelo

Añadir `"gemini-flash-lite": "gemini-2.5-flash-lite"` al mapa de aliases. Actualmente no existe este alias.

También actualizar las tarifas en `cost-tracker.ts`:
- `"gemini-2.5-flash-lite"`: `{ inputPerMillion: 0.25, outputPerMillion: 1.50 }`

#### 2. `supabase/functions/pattern-detector-pipeline/index.ts` — Reescribir `pipeline_run` (líneas 1954-2336)

Reescribir el bloque completo para ejecutar las 9 fases inline (sin persistir en DB del detector):

| Fase | Modelo | maxTokens | Propósito |
|------|--------|-----------|-----------|
| Phase 1: Domain | `gemini-pro` | 8192 | Comprensión profunda del briefing — prompt completo del standalone |
| Phase 2: Sources | `gemini-flash-lite` | 8192 | Descubrimiento de fuentes — mecánico |
| Phase 3: Quality Gate | Sin LLM | — | Algorítmico, nunca FAIL |
| Phase 4: Confidence | Sin LLM | — | Calcular confidence cap |
| Phase 5: Signals | `gemini-pro` | 12288 | Detección 5 capas — prompt completo con unconventional signals, composite metrics, devil's advocate |
| Credibility Engine | `gemini-pro` | 8192 | 4 dimensiones (estabilidad 30%, replicabilidad 25%, anticipación 25%, SNR 20%) + clasificación Alpha/Beta/Fragile/Noise + régimen |
| Phase 6: Backtest | `gemini-flash-lite` | 8192 | Estimaciones técnicas (RMSE, win rate, precision/recall, retrospective cases) |
| Economic Backtest | `gemini-flash-lite` | 8192 | Impacto económico con parámetros sectoriales |
| Phase 7: Hypotheses | `gemini-flash-lite` | 8192 | Hipótesis accionables + learning metrics + verdict |

**Lógica clave por fase:**

- **Phase 1**: Usa el prompt completo del standalone (líneas 201-226) enriquecido con briefing/scope/solution_candidates. Modelo `gemini-pro` en vez de `gemini-flash`.
- **Phase 2**: Prompt del standalone (líneas 277-327) con unconventional sources block + solution candidates. Modelo `gemini-flash-lite`.
- **Phase 3**: Misma fórmula optimizada (multiplicador 18 + reliability bonus). Floor PASS_CONDITIONAL.
- **Phase 4**: Sin LLM. Calcula `maxConfidenceCap` basado en QG status (0.7 para PASS, 0.6 para PASS_CONDITIONAL, 0.5 para floor).
- **Phase 5**: Prompt completo del standalone (líneas 701-754) con unconventional system rules para centros_comerciales, composite metrics block, hardcoded signals injection. Modelo `gemini-pro`, maxTokens 12288. Incluye vinculación con componentes existentes del audit.
- **Credibility Engine**: Prompt del standalone (líneas 931-982). Evalúa las 4 dimensiones con pesos fijos (0.30/0.25/0.25/0.20). Clasifica Alpha/Beta/Fragile/Noise. Detecta régimen de mercado. Modelo `gemini-pro`.
- **Phase 6**: Prompt del standalone (líneas 1077-1120). Estima RMSE, win rate, precision, recall, retrospective cases. Modelo `gemini-flash-lite`.
- **Economic Backtesting**: Prompt del standalone (líneas 1194-1287). Usa `detectSectorParams(sector)` para parámetros económicos. Calcula gross_revenue_protected, ROI, payback, error_intelligence, validation_plans. Modelo `gemini-flash-lite`.
- **Phase 7**: Prompt del standalone (líneas 1375-1427). Genera hipótesis accionables, verdict, learning_metrics. Modelo `gemini-flash-lite`.

**Extracción inteligente del sector/geography**: Si el briefing no tiene `sector_detectado` o `geography`, hacer una llamada rápida con `gemini-flash-lite` para extraerlos del texto completo del briefing.

**Output enriquecido**: El `PatternDetectorOutput` devuelto incluirá:
```typescript
{
  signals_by_layer: Record<string, Signal[]>,
  credibility_engine: {
    regime_detected: string,
    regime_reasoning: string,
    classifications: { signal_id: string, class: "Alpha"|"Beta"|"Fragile"|"Noise", score: number }[],
    summary: { alpha: number, beta: number, fragile: number, noise: number }
  },
  backtesting: {
    win_rate_pct: number, precision_pct: number, recall_pct: number,
    avg_anticipation_days: number, retrospective_cases: any[],
    uplift_vs_baseline_pct: number, complexity_justified: boolean
  },
  economic_backtesting: {
    net_economic_impact: number, roi_multiplier: number, payback_period_days: number,
    per_unit_impact: number, event_breakdown: any[], error_intelligence: any[],
    validation_plans: any[], assumptions: any
  },
  hypotheses: { title: string, confidence: number, validation_method: string }[],
  model_verdict: string,
  external_sources: { required: any[], recommended: any[], experimental: any[] },
  rags_externos_needed: any[],
  quality_gate: { verdict: string, coverage_pct: number, gaps: string[], confidence_cap: number },
  prd_injection: {
    patrones_section: string,       // Enriched with credibility classes + regime
    rags_adicionales: string,       // + validation plans from economic backtest
    integraciones_externas: string, // + integration costs from sources
  },
  confidence_cap: number,
}
```

**PRD injection enriquecida**:
- **Sección 7**: Señales + clasificación credibilidad (Alpha/Beta/Fragile) + régimen detectado
- **Sección 15.1**: RAGs externos + validation plans del economic backtest
- **Sección 19**: Fuentes externas + coste integración + frecuencia + ROI estimado

#### 3. `supabase/functions/_shared/cost-tracker.ts` — Añadir tarifa flash-lite

Añadir `"gemini-2.5-flash-lite"` y alias `"gemini-flash-lite"` a `MODEL_RATES`.

#### 4. `src/config/projectCostRates.ts` — Añadir tarifa flash-lite

Añadir `"gemini-flash-lite"` al `RATES` map.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/_shared/ai-client.ts` | Añadir alias `"gemini-flash-lite"` → `"gemini-2.5-flash-lite"` |
| `supabase/functions/_shared/cost-tracker.ts` | Añadir tarifa `gemini-2.5-flash-lite` y `gemini-flash-lite` |
| `src/config/projectCostRates.ts` | Añadir tarifa `gemini-flash-lite` |
| `supabase/functions/pattern-detector-pipeline/index.ts` | Reescribir `pipeline_run` (líneas 1954-2336) con 9 fases completas |

### Estimaciones

- **LLM calls por ejecución**: 5 con `gemini-pro` + 4 con `gemini-flash-lite` = 9 llamadas
- **Tiempo estimado**: 90-150s (9 llamadas × 10-17s media)
- **Coste estimado por ejecución**: ~$0.08-0.12
- **Timeout**: Cubierto por `waitUntil` del wizard-step (400s límite Supabase)

