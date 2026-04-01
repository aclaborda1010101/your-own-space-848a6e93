

# Plan: Invertir el Flujo del Pipeline -- Primero Patrones, Luego Fuentes

## El Problema (tienes razón)

El flujo actual es:

```text
Phase 1: Comprensión del sector (genérica)
Phase 2: Buscar fuentes de datos (el LLM inventa 5-8 fuentes genéricas)
Phase 3: Quality Gate (evalúa cobertura con las pocas fuentes)
Phase 4: Confidence Cap
Phase 4b: Benchmarks (solo centros_comerciales)
Phase 5: Detectar señales/patrones ← AQUÍ recién decide qué buscar
Phase 6: Backtesting
Phase 7: Hipótesis
```

El problema: las fuentes (Phase 2) se eligen SIN saber qué patrones se necesitan. El LLM genera 5-8 fuentes genéricas (INE, Google Trends, etc.) y luego en Phase 5 intenta detectar patrones sofisticados que NO puede fundamentar porque no tiene las fuentes necesarias. Es como ir a comprar ingredientes sin saber qué vas a cocinar.

## La Solución: Nuevo Flujo "Pattern-First"

```text
Phase 1: Comprensión del sector (se mantiene igual)
Phase 1b: NUEVO — Diseño de Patrones por Capa
   → Define QUÉ patrones buscar en cada capa (1-5)
   → Para cada patrón: qué datos necesita, qué fuente los tiene
   → Output: mapa patrón→fuente requerida
Phase 2: Búsqueda de Fuentes DIRIGIDA
   → Recibe el mapa de Phase 1b como input
   → Busca fuentes ESPECÍFICAS para cada patrón definido
   → Genera 15-25 fuentes (no 5-8) porque sabe exactamente qué necesita
Phase 3-7: Se mantienen igual pero con datos mucho más ricos
```

## Cambios Concretos

### 1. Nueva Phase 1b: `executePhase1b` — Pattern Design Map

Se inserta entre Phase 1 y Phase 2. Recibe el output de Phase 1 (sector analysis, key variables, causal hypotheses) y genera:

```json
{
  "pattern_map": [
    {
      "layer": 3,
      "layer_name": "Señales débiles",
      "patterns": [
        {
          "pattern_name": "Rotación Locales Comerciales",
          "what_to_detect": "Tasa de cierre/apertura de locales en radio 5km",
          "why_matters": "Alta rotación = zona inestable o en transición",
          "data_needed": ["listados inmobiliarios comerciales", "licencias actividad económica"],
          "ideal_sources": ["Idealista API", "Datos abiertos ayuntamiento"],
          "minimum_frequency": "weekly",
          "minimum_history": "24 meses",
          "detection_method": "trend_analysis",
          "decision_enabled": "Evitar zonas con rotación >15% anual"
        }
      ]
    }
  ],
  "total_unique_sources_needed": 18,
  "coverage_by_layer": { "1": 4, "2": 5, "3": 6, "4": 5, "5": 4 }
}
```

El prompt exige un mínimo de 3 patrones por capa (15-25 total) y que cada patrón declare explícitamente sus fuentes necesarias.

### 2. Modificar Phase 2: Source Discovery DIRIGIDA

Actualmente Phase 2 recibe solo `key_variables` de Phase 1. Se cambia para que reciba el `pattern_map` de Phase 1b como input principal. El prompt se reformula:

- "Para cada patrón definido, busca la mejor fuente de datos disponible"
- El catálogo de `SECTOR_UNCONVENTIONAL_SOURCES` se inyecta como referencia
- Se exige que cada fuente se vincule a al menos un patrón del mapa
- Mínimo 15 fuentes (vs las 5-8 actuales)

### 3. Actualizar Phase 5: Referencias cruzadas con el mapa

Phase 5 recibe el `pattern_map` de Phase 1b para verificar que genera señales para TODOS los patrones planificados, no solo los que el LLM decide inventar. Si un patrón del mapa no tiene señal, debe explicar por qué (falta de fuente vs irrelevancia).

### 4. Actualizar Quality Gate (Phase 3)

El Quality Gate evalúa cobertura contra el `pattern_map`: no solo "cuántas fuentes tengo" sino "cuántos patrones planificados tienen fuentes disponibles". Cambia la métrica de cobertura.

### 5. Integrar en `run_all` y `pipeline_run`

Añadir la llamada a Phase 1b en ambos flujos de ejecución, entre Phase 1 y Phase 2.

## Archivos Modificados
1. `supabase/functions/pattern-detector-pipeline/index.ts` — nueva Phase 1b + modificar Phase 2, 3, 5

## Lo que NO se toca
- Phase 4, 4b, 6, 7 (no cambian)
- Public Query Handler, API keys, feedback
- Serve handler structure
- UI (no necesita cambios, los datos fluyen igual)
- No hay migración de BD

