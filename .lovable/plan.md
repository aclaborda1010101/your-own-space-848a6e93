
# Fix: Autocorreccion del Quality Gate con fuentes de supply chain

## Problema actual

La autocorreccion en Phase 3 (lineas 246-293) tiene 2 iteraciones para farmacia, pero:
- Iteracion 0 anade fuentes epidemiologicas (lado demanda) que probablemente ya fueron descubiertas por la IA en Phase 2
- Iteracion 1 tiene algunas fuentes de supply chain pero incompletas
- Faltan fuentes criticas: Datacomex, EMA Shortages, AEMET
- La formula de cobertura (`sourceList.length * 12`) no llega al 80% si hay solapamiento con fuentes existentes

## Cambios en `supabase/functions/pattern-detector-pipeline/index.ts`

### 1. Reestructurar iteraciones de autocorreccion (lineas 253-270)

**Iteracion 0 -- Supply chain y distribucion:**

| Fuente | Tipo | Frecuencia | Fiabilidad |
|--------|------|------------|------------|
| Datacomex (Ministerio de Industria) | Gov | monthly | 8 |
| EMA Shortages Catalogue | Gov | daily | 9 |
| INE - Encuesta Industrial CNAE 21 | Gov | annual | 8 |

**Iteracion 1 -- Senales tempranas complementarias:**

| Fuente | Tipo | Frecuencia | Fiabilidad |
|--------|------|------------|------------|
| CGCOF/CISMED | Report | weekly | 7 |
| BOE/AEMPS Alertas | Gov | daily | 9 |
| AEMET | API | daily | 8 |

### 2. Ajustar umbral PASS_CONDITIONAL (lineas 307-317)

Actualmente: si cobertura >= 80% => PASS_CONDITIONAL.

Nuevo comportamiento:
- >= 80%: PASS con cap 70%
- 75-79%: PASS_CONDITIONAL con cap 60%
- < 75%: FAIL

### 3. Actualizar frecuencias de actualizacion

Cada fuente tendra su frecuencia real (daily, weekly, monthly, annual) en vez del generico "weekly" para todas.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Reemplazar fuentes en iteraciones 0-1, ajustar umbral PASS_CONDITIONAL |

## Resultado esperado

- Iteracion 0 cubre el lado oferta: produccion, importacion, desabastecimientos europeos
- Iteracion 1 cubre senales tempranas: reportes de campo, regulacion, clima
- Se anaden 2 tipos nuevos (Report, API) ampliando la diversidad
- Si cobertura llega a 75-80%, el pipeline continua con cap adecuado
- El pipeline completo se ejecuta en Escenario B con la confianza correcta
