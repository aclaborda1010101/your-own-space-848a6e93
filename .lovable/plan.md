## Plan: Equiparar pipeline_run al detector standalone — 9 fases completas ✅ DONE

### Cambios implementados

1. **`_shared/ai-client.ts`** — Nuevo alias `"gemini-flash-lite"` → `"gemini-2.5-flash-lite"`

2. **`_shared/cost-tracker.ts`** — Tarifas actualizadas:
   - `gemini-2.5-flash-lite` / `gemini-flash-lite`: $0.25/$1.50 per million
   - `gemini-3.1-pro-preview` / `gemini-pro`: $2.00/$12.00 per million (actualizado de $1.25/$5.00)

3. **`src/config/projectCostRates.ts`** — Añadido `gemini-flash-lite` y actualizado `gemini-pro` a $2.00/$12.00

4. **`pattern-detector-pipeline/index.ts`** — `pipeline_run` reescrito con 9 fases completas:

| Fase | Modelo | maxTokens | Propósito |
|------|--------|-----------|-----------|
| Extracción contexto | `gemini-flash-lite` | 1024 | Extraer sector/geography del briefing si faltan |
| Phase 1: Domain | `gemini-pro` | 8192 | Comprensión profunda del briefing |
| Phase 2: Sources | `gemini-flash-lite` | 8192 | Descubrimiento de fuentes |
| Phase 3: Quality Gate | Sin LLM | — | Algorítmico, nunca FAIL |
| Phase 4: Confidence | Sin LLM | — | Calcular confidence cap |
| Phase 5: Signals | `gemini-pro` | 12288 | Detección 5 capas con devil's advocate |
| Credibility Engine | `gemini-pro` | 8192 | 4 dimensiones + Alpha/Beta/Fragile/Noise + régimen |
| Phase 6: Backtest | `gemini-flash-lite` | 8192 | Win rate, precision, recall, RMSE |
| Economic Backtest | `gemini-flash-lite` | 8192 | ROI, payback, error_intelligence, validation_plans |
| Phase 7: Hypotheses | `gemini-flash-lite` | 8192 | Hipótesis accionables + verdict |

### Output enriquecido

```
{
  signals_by_layer, credibility_engine, backtesting, economic_backtesting,
  hypotheses, model_verdict, external_sources, rags_externos_needed,
  quality_gate, prd_injection, confidence_cap
}
```

### PRD injection enriquecida

- **Sección 7**: Señales + clasificación credibilidad (Alpha/Beta/Fragile) + régimen + hipótesis
- **Sección 15.1**: RAGs externos + validation plans del economic backtest
- **Sección 19**: Fuentes externas + impacto económico (NEI, ROI, payback)

### Flujo completo

```
Briefing → [Extracción sector/geo] → Domain(pro) → Sources(flash-lite) → QG → Confidence
  → Signals(pro) → Credibility(pro) → Backtest(flash-lite) → Economic(flash-lite) → Hypotheses(flash-lite)
  → PRD injection enriquecida
```
