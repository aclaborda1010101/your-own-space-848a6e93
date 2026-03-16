
Problema detectado:
El bloqueo no viene del frontend. El detector de la página `/projects/detector` sigue ejecutando la ruta antigua `run_all`, y esa ruta todavía usa `executePhase3()` con la lógica legacy del Quality Gate:
- cobertura = `sources * 12`
- si falla, guarda `status: "blocked"` y `model_verdict: "BLOCKED"`
- `run_all` corta el pipeline con `if (qg.status === "FAIL") return`

Mientras tanto, la versión nueva no bloqueante solo se aplicó en `pipeline_run` del wizard. Por eso el wizard ya funciona y el detector standalone sigue bloqueándose.

Qué hay que cambiar:
1. Unificar la lógica del Quality Gate
- Extraer o reusar la lógica nueva “never FAIL” también para el flujo standalone.
- `executePhase3()` debe dejar de devolver `FAIL` bloqueante para el detector normal.
- Mantener estados:
  - `PASS`
  - `PASS_CONDITIONAL`
- Si la cobertura es baja, degradar confianza, pero no bloquear.

2. Actualizar `executePhase3()` legacy
- Sustituir:
  - multiplicador `* 12`
  - umbral FAIL final
  - `status: "blocked"` / `model_verdict: "BLOCKED"`
- Por la fórmula ya validada:
  - multiplicador más generoso
  - bonus por fiabilidad media alta
  - floor a `PASS_CONDITIONAL`
- Guardar `quality_gate_passed: true` cuando el análisis pueda continuar, aunque sea condicional.

3. Ajustar `run_all` y `execute_remaining`
- Eliminar la salida temprana:
  - `if (qg.status === "FAIL") return`
- Ambas rutas deben continuar a fases 4–7 con cap de confianza reducido cuando aplique.

4. Mantener degradación real, no maquillaje
- Fase 4 debe seguir aplicando cap de confianza:
  - `0.7` si PASS sin datos propios
  - `0.6` o `0.5` si PASS_CONDITIONAL
- La UI seguirá mostrando advertencia, pero no “bloqueado”.

5. Ajustar el estado final que verá la UI
- El detector no debe terminar en `blocked` por insuficiencia de fuentes identificadas.
- Debe terminar en:
  - `completed` si el pipeline acaba
  - `failed` solo si hay error real técnico/LLM/parsing
- El veredicto puede ser `CONDITIONAL` o “No fiable aún”, pero no bloquear la ejecución.

6. Revisar mensajes del frontend
Archivos implicados:
- `src/hooks/usePatternDetector.tsx`
- `src/components/projects/PatternDetector.tsx`

Cambio previsto:
- Dejar de tratar “calidad insuficiente” como bloqueo terminal.
- Mostrar estado condicional/advertencia basado en `quality_gate.status` o `model_verdict`, no en `currentRun.status === "blocked"`.

Implementación concreta:
- `supabase/functions/pattern-detector-pipeline/index.ts`
  - modificar `executePhase3()`
  - modificar `run_all`
  - modificar `execute_remaining`
- `src/hooks/usePatternDetector.tsx`
  - ajustar polling para no esperar `blocked` como final normal
- `src/components/projects/PatternDetector.tsx`
  - cambiar badge/label para reflejar “condicional” en lugar de “bloqueado” cuando el análisis continúe

Resultado esperado:
- El detector standalone tendrá el mismo comportamiento que el pipeline integrado:
  - genera las 5 capas
  - no se para por Quality Gate
  - reduce confianza cuando faltan datos
  - solo falla por errores reales

Riesgo principal:
- Hay que asegurarse de no romper el caso legacy en que un fallo técnico sí debe seguir marcándose como `failed`.
- El cambio debe limitarse al bloqueo por Quality Gate, no a la gestión general de errores.
