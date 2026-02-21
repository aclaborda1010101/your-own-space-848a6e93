

# Quality Gate: PASS_CONDITIONAL para Escenario B (sin datos del usuario)

## Problema

El Quality Gate (Phase 3) bloquea el pipeline cuando no puede verificar las fuentes externas. En el Escenario B (sin datos propios del usuario), el pipeline se queda en "BLOCKED" y no genera ningun output.

## Solucion

Modificar Phase 2, Phase 3 y Phase 4 para soportar un nuevo status `PASS_CONDITIONAL` que desbloquea el pipeline cuando las fuentes estan identificadas pero no conectadas.

## Cambios en `supabase/functions/pattern-detector-pipeline/index.ts`

### 1. Phase 2: Marcar fuentes como "pending"

Cambiar el status de insercion de fuentes de `"active"` a `"pending"` (linea 174). Las fuentes se registran como "identificadas -- pendientes de conexion".

### 2. Phase 3: Nueva logica PASS_CONDITIONAL

Despues de calcular las metricas del Quality Gate, anadir esta logica:

- Si el gate falla (coverage < 80%, etc.), verificar cuantas fuentes hay en total con status "pending"
- Calcular "cobertura teorica" basada en las fuentes pendientes (como si estuvieran conectadas)
- Si la cobertura teorica supera el 80%, cambiar el status a `PASS_CONDITIONAL` en vez de `FAIL`
- En PASS_CONDITIONAL:
  - `blocking = false` (no bloquea el pipeline)
  - `quality_gate_passed = true`
  - `model_verdict = "CONDITIONAL"`
  - Anadir nota: "Fuentes identificadas pero no integradas. Cap de confianza: 60%"
  - Registrar las fuentes sectoriales conocidas (FEDIFAR, Datacomex, EMA, INE, BOE/AEMPS, CGCOF/CISMED) como fuentes "pending" si no existen ya

### 3. Phase 4: Cap de confianza 60% en modo condicional

Cambiar la logica del cap de confianza:
- Con datos del usuario: sin cap (1.0)
- Sin datos del usuario + Quality Gate PASS: cap 70%
- Sin datos del usuario + Quality Gate PASS_CONDITIONAL: cap 60%

### 4. Phase 5: Marcar outputs como parcialmente verificados

En el prompt del sistema de Phase 5, si el cap es 0.6, anadir la indicacion de que todos los outputs deben marcarse como "basados en fuentes parcialmente verificadas".

### 5. run_all: No bloquear en PASS_CONDITIONAL

Cambiar la condicion de parada (linea 835):
```
if (qg.status === "FAIL") return; // Blocked
```
a:
```
if (qg.status === "FAIL") return; // Blocked
// PASS_CONDITIONAL continua con cap reducido
```

## Archivo a modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Phase 2 status, Phase 3 logica PASS_CONDITIONAL, Phase 4 cap 60%, Phase 5 disclaimer, run_all no bloquear |

## Flujo resultante

```text
Phase 1: Domain Comprehension (sin cambios)
Phase 2: Source Discovery -> fuentes con status "pending"
Phase 3: Quality Gate ->
   - Si cobertura real >= 80%: PASS
   - Si cobertura real < 80% PERO cobertura teorica >= 80%: PASS_CONDITIONAL
   - Si cobertura teorica < 80%: FAIL (sigue bloqueado)
Phase 4: Data Assessment -> cap 60% si PASS_CONDITIONAL
Phase 5: Pattern Detection -> 5 capas con cap 60%, outputs marcados como parciales
Phase 6: Backtesting -> estimaciones con disclaimer adicional
Phase 7: Hypotheses -> output completo con todos los JSONs
```

## Sin cambios de base de datos

No se necesitan nuevas tablas ni columnas. El campo `quality_gate.status` ya es un string libre, y `model_verdict` tambien acepta cualquier valor.

