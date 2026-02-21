
# Correcciones: Economic Backtesting parametrizado por sector + Freshness + Idioma

## 5 problemas identificados, 4 archivos a modificar

---

## 1. Economic Backtesting parametrizado por sector (Bug critico)

### Problema
La funcion `executeEconomicBacktesting` tiene hardcodeado:
- System prompt: "analista financiero para farmacias"
- `per_pharmacy_impact` en el JSON de respuesta esperado
- `total_pharmacies: 3800` hardcodeado en el insert
- `margin_used_pct: 30` hardcodeado
- UI: textos "POR FARMACIA" y "TOTAL RED (x3.800)"

### Solucion
Crear un mapa de parametros economicos por sector en el edge function:

```text
SECTOR_ECONOMIC_PARAMS = {
  farmacia: {
    unit_name: "farmacia",
    unit_name_plural: "farmacias",
    default_units: 3800,
    default_margin_pct: 30,
    avg_investment: 50000,        // EUR
    impact_per_correct: "miles",  // escala
    impact_per_failure: "miles",
    cost_of_capital_pct: 5,
    system_prompt_context: "farmacias en Espana. Margen conservador 30%..."
  },
  centros_comerciales: {
    unit_name: "localizacion evaluada",
    unit_name_plural: "localizaciones",
    default_units: 1,
    default_margin_pct: 15,
    avg_investment: 40000000,     // EUR (40M)
    impact_per_correct: "millones",
    impact_per_failure: "millones",
    cost_of_capital_pct: 8,
    system_prompt_context: "centros comerciales. Inversion media 20-80M EUR, ventas anuales 5-15M..."
  },
  default: {
    unit_name: "unidad de negocio",
    ...parametros conservadores genericos
  }
}
```

Cambios en `executeEconomicBacktesting`:
- Recibir `sector` como parametro (ya disponible en `run.sector` en `run_all`)
- Detectar el sector con regex y seleccionar los parametros correctos
- Inyectar los parametros en el system prompt de la IA
- Cambiar el JSON de respuesta: `per_unit_impact` en vez de `per_pharmacy_impact`
- Usar `params.default_units` en vez de `3800`
- Guardar `sector_params` en el campo `assumptions` del insert

Cambios en la UI (`PatternDetector.tsx`):
- Leer `assumptions.unit_name` del economic backtest para mostrar el nombre correcto
- Fallback a "unidad" si no existe
- Cambiar "POR FARMACIA" por "POR {unit_name.toUpperCase()}"
- Cambiar "TOTAL RED (x3.800)" por "TOTAL RED (x{total_units})" o ocultarlo si `total_units === 1`

---

## 2. Freshness al 0% (Bug en calculo)

### Problema
Lineas 249-251: la frescura se calcula como porcentaje de fuentes que tienen `update_frequency` en ["daily", "weekly", "monthly"]. Pero las fuentes con `update_frequency = "annual"` (como INE, Catastro) se excluyen, y si `update_frequency` es null o un valor no esperado, tambien se excluyen.

Para centros comerciales, la IA probablemente genero fuentes con `update_frequency` null o con valores como "irregular", "varies", etc.

### Solucion
Ampliar la definicion de "fresca" para incluir `annual` (que tiene datos actuales aunque se actualice una vez al ano). La frescura debe medir si la fuente tiene datos recientes, no solo si se actualiza frecuentemente.

Nueva formula:
- Fuentes con update_frequency != null y != "unknown" => consideradas "con metadatos de frescura"
- freshnessPct = (fuentes con metadatos de frescura / total fuentes) * 100
- Si update_frequency es null, contar como "sin metadatos" pero no como 0

Alternativa mas simple: incluir "annual" en la lista de frecuencias validas:
```
["daily", "weekly", "monthly", "quarterly", "annual", "biannual"]
```

---

## 3. Idioma: todo en espanol

### Problema
El prompt de economic backtesting y Phase 7 no especifica explicitamente que los textos deben estar en espanol. La IA puede generar `error_intelligence`, `validation_plans`, `event_breakdown` en ingles.

### Solucion
Anadir al system prompt de `executeEconomicBacktesting` y Phase 7:
- "TODOS los textos de respuesta deben estar en ESPANOL. Eventos, analisis, recomendaciones, todo en espanol."

---

## 4. Impactos economicos calibrados al sector

### Problema
Los impactos se calculan con logica de farmacia (unidades x precio x 30% margen) para un proyecto de centros comerciales donde el impacto real es de millones.

### Solucion
Ya cubierto por el punto 1. El system prompt parametrizado por sector dara a la IA el contexto correcto:
- Para centros comerciales: "Inversion media por centro comercial: 20-80M EUR. Ventas medias anuales: 5-15M EUR. Coste de mala ubicacion: perdida parcial o total de la inversion (10-50M EUR). Acertar ubicacion: 5-15M EUR/ano en ventas."
- La IA calibrara los impactos de cada evento al sector correcto

---

## 5. Campo sector_economic_parameters

### Problema
No existe un campo para que el usuario pueda personalizar parametros economicos por proyecto.

### Solucion
No se requiere nueva tabla SQL. Se anade el mapa de parametros en el edge function como constante. Si en el futuro el usuario quiere personalizar, se puede anadir un campo JSONB a `pattern_detector_runs`, pero por ahora el mapa por sector es suficiente.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | 1) Mapa de parametros por sector. 2) `executeEconomicBacktesting` recibe sector y usa parametros. 3) System prompt parametrizado y en espanol. 4) Freshness incluye "annual". 5) `run_all` pasa sector al economic backtesting |
| `src/components/projects/PatternDetector.tsx` | UI adaptativa: leer unit_name de assumptions, cambiar textos "farmacia" por nombre dinamico |

## Orden de implementacion

1. Edge function: mapa de parametros, freshness fix, prompts en espanol, economic backtesting parametrizado
2. UI: textos dinamicos en seccion de impacto economico
3. Deploy y test
