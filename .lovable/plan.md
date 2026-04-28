# Diagnóstico: Brief generado pero PRD no se ha lanzado

## Lo que ha pasado realmente

He revisado el proyecto **"Predicción Stock"** (`b35eca56…`) en la base de datos:

| Paso | Estado | Aprobado |
|------|--------|----------|
| 1 — Entrada (transcripción) | `approved` | ✅ Sí |
| 2 — Briefing (extracción + normalización) | `review` (v2) | ❌ **No aprobado** |
| 3 — PRD | — | No existe |
| 4 — MVP | — | No existe |

**Conclusión:** El brief **sí se generó correctamente** (119 KB extraído, 893 chars limpios tras normalización, sin errores en logs). Lo que falta es que **tú apruebes el Brief en el Paso 2** para que el wizard dispare automáticamente el Paso 3 (PRD) y luego el resto del pipeline.

En el código (`useProjectWizard.ts` línea 1132-1147) el flujo es explícito:
> *"After approving Brief (step 2): jump to step 3 and auto-launch chained PRD."*

Es decir: sin click en **"Aprobar Brief"**, no se lanza nada más. No es un bug — es el guardrail diseñado para que revises el brief antes de gastar tokens en el PRD.

## Por qué crees que "no ha generado nada"

El Paso 2 está en estado `review` y muestra el brief para que lo valides. Probablemente:
- No has pulsado el botón **"Aprobar Brief"** (o equivalente) en la UI del Paso 2.
- O lo pulsaste pero la llamada falló silenciosamente (no veo errores de aprobación en los logs de la edge function).

## Plan de acción (al pasar a modo build)

### Opción A — Recomendada: solo verificar el flujo manual
1. Abrir el Paso 2 en la UI y revisar que el botón **"Aprobar Brief"** esté visible y funcional.
2. Añadir un log/toast más explícito si la aprobación falla, para que no quede ambiguo.
3. Si el botón funciona: pulsarlo manualmente → el wizard encadenará Step 3 (PRD) automáticamente.

### Opción B — Desbloqueo manual desde DB
Si prefieres no tocar la UI ahora, puedo:
1. Marcar Step 2 como `approved` directamente vía migración SQL.
2. Disparar manualmente la generación del Step 3 (PRD) llamando a la edge function `project-wizard-step` con los parámetros adecuados.

### Opción C — Auto-aprobar Brief (cambio de comportamiento)
Cambiar la regla para que tras normalización exitosa el Brief se auto-apruebe y dispare PRD sin intervención. **No lo recomiendo**: pierdes el control de revisión y el Brief de Predicción Stock tiene solo 893 chars limpios — conviene revisarlo antes.

## Pregunta para ti

¿Qué prefieres?
- **A**: Reviso/refuerzo el botón de aprobar Brief en la UI (5 min, seguro).
- **B**: Forzamos ahora la aprobación + lanzamiento del PRD para este proyecto concreto desde backend (rápido, one-shot).
- **C**: Auto-aprobación tras normalización (cambio de política global, no recomendado).
