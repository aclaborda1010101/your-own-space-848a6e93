

# Fix: Mostrar precios editados en el Presupuesto del Resumen Ejecutivo

## Problema

Los campos `setup_price_eur` y `monthly_price_eur` en los modelos de monetización pueden ser:
- Números puros editados por el usuario: `"4500"`, `"35"` → `Number()` funciona
- Rangos generados por la IA: `"€22.000-28.000"`, `"22000-28000"` → `Number()` devuelve `NaN`, `NaN || 0` = `0`

El código actual (línea 1942-1948) hace `Number(model.setup_price_eur) || 0`, lo que descarta los rangos string. Y como `setupVal`, `monthlyVal` y `annualVal` son todos 0, y `price_range` también puede estar vacío, no se renderiza ningún precio.

## Solución

Cambiar la lógica de renderizado en `generate-document/index.ts` (líneas 1941-1948) para:

1. Intentar convertir a número con `Number()`
2. Si es un número válido > 0, mostrar formateado con `toLocaleString`
3. Si NO es un número válido pero el string existe y no está vacío, mostrar el string tal cual (es un rango)
4. Mantener `price_range` como último fallback

```typescript
// Para cada campo: si es número, formatearlo; si es string no numérico, mostrarlo tal cual
const rawSetup = model.setup_price_eur;
const rawMonthly = model.monthly_price_eur;
const rawAnnual = model.annual_price_eur;
const setupNum = Number(rawSetup);
const monthlyNum = Number(rawMonthly);
const annualNum = Number(rawAnnual);

if (!isNaN(setupNum) && setupNum > 0) {
  metrics.push(`...€${setupNum.toLocaleString("es-ES")}...Setup`);
} else if (rawSetup && String(rawSetup).trim()) {
  metrics.push(`...${escHtml(String(rawSetup))}...Setup`);
}
// Igual para monthly y annual
// price_range solo si no hay nada más
```

## Fichero

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | Líneas 1941-1948: reescribir lógica de precios para soportar números Y strings de rango |

