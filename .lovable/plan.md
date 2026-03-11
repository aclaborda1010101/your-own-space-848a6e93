

# Fix: Precios reales del presupuesto + eliminar duración de fases en títulos

## Problemas

1. **Precios genéricos en vez de reales**: El PDF muestra `€22000-28000` y `€35000-45000` (campo `price_range`) en vez de los valores editados (`setup_price_eur: 4500`, `monthly_price_eur: 35`). Esto ocurre porque el campo `price_range` tiene prioridad cuando `setup_price_eur` y `monthly_price_eur` son números en vez de strings, o porque el renderer muestra `price_range` cuando los campos específicos no coinciden con el formato esperado.

2. **Duración en semanas en títulos de fase**: Los headings del scope contienen "6 semanas", "8 semanas" en el título (ej: `## Fase 0: Prueba de Concepto (PoC) - 6 semanas`). El regex actual intenta reemplazar la duración pero no la elimina. El usuario quiere que NO aparezca ninguna duración en los títulos de las fases del scope, ya que el cronograma ya tiene esa info.

## Cambios en `supabase/functions/generate-document/index.ts`

### Fix 1: Eliminar duración de títulos de fase en el scope (línea ~1806-1831)

Añadir un regex que elimine patrones tipo `- X semanas` o `(X semanas)` de los headings `##`:

```typescript
// Strip duration from phase headings: "## Fase 0: PoC - 6 semanas" → "## Fase 0: PoC"
cleanScope = cleanScope.replace(
  /^(##\s+.+?)\s*[-–—]\s*\d+\s*semanas?\s*$/gim, 
  '$1'
);
cleanScope = cleanScope.replace(
  /^(##\s+.+?)\s*\(\s*\d+\s*semanas?\s*\)\s*$/gim, 
  '$1'
);
```

Esto se aplica ANTES del `stripHeadingNumbers`.

### Fix 2: Usar precios reales del budget editado (líneas 1944-1960)

El problema es que `model.setup_price_eur` y `model.monthly_price_eur` son números (4500, 35) pero el renderer los trata como strings. Cuando están como números, `if (model.setup_price_eur)` funciona pero `escHtml(String(...))` debería funcionar también. El problema real es que `price_range` (ej: "€22000-28000") aparece en la condición `if (!model.setup_price_eur && !model.monthly_price_eur)` — pero mirando el PDF, los precios que aparecen SON los de `price_range`, lo que indica que `setup_price_eur` es falsy (0 o null) cuando llega al renderer.

Revisando `sanitizeBudgetForClient`: pasa los modelos filtrados con `{ your_margin_pct, _score, ...rest }`. Los campos `setup_price_eur` y `monthly_price_eur` deberían estar en `rest`. El problema puede ser que los valores editados en el panel se guardan como strings (ej: "4500") y el renderer compara correctamente, pero mirando más de cerca el PDF muestra `price_range` en vez de los valores individuales.

La solución: en el renderer de step 101, forzar la lectura de `setup_price_eur` y `monthly_price_eur` convirtiendo a número, y NO mostrar `price_range` cuando existan valores individuales. Además, asegurar que se muestren los valores numéricos correctos.

```typescript
const setup = Number(model.setup_price_eur) || 0;
const monthly = Number(model.monthly_price_eur) || 0;
const annual = Number(model.annual_price_eur) || 0;

if (setup > 0) metrics.push(`...€${setup.toLocaleString("es-ES")}...Setup`);
if (monthly > 0) metrics.push(`...€${monthly}/mes...Mensual`);
if (annual > 0) metrics.push(`...€${annual.toLocaleString("es-ES")}/año...Anual`);
// Only show price_range if NO specific prices exist
if (!setup && !monthly && !annual && model.price_range) metrics.push(price_range);
```

## Fichero

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | (1) Strip duración en semanas de headings de fases. (2) Forzar lectura numérica de precios y priorizar sobre `price_range`. |

