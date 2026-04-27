# Por qué sigues viendo 14.500€ — diagnóstico exacto

He consultado la BBDD y tengo la respuesta concreta:

## Lo que hay realmente guardado

**Step 6 (presupuesto), versión 8, status `approved`, guardado a las 18:05:**
```
total_development_eur: 12.400         ✅ correcto
m0_setup_price_eur:    "12.400"       ✅ sincronizado
recommended_model:     "Desarrollo a Medida + Mantenimiento Mensual"
consulting_retainer:
  enabled:           NULL  ← ❌ AQUÍ ESTÁ EL BUG #1
  monthly_fee_eur:   3500
  monthly_hours:     35
implementation_override:
  mvp_weeks:   8
  start_date:  "2026-05-04"           ✅ correcto
```

**Step 30 (propuesta cliente), solo versión 1, generada a las 06:34:**
```
setup_fee:           14500   ← ❌ BUG #2: PDF VIEJO
setup_fee_display:   "14.500 EUR"
consulting_enabled:  null
schedule.start_date: null
```

## Las dos causas reales

1. **El checkbox "Activar consultoría" nunca se marcó.** En tu screenshot el círculo está vacío. Rellenaste cuota (3.500€), horas (35) y % descuento (50), pero sin marcar el checkbox `enabled` quedó `null` → el mapper no aplica descuento ni renderiza el bloque.

2. **No has pulsado "Generar propuesta cliente" después de editar.** El Step 30 sigue en v1 del 06:34 (antes de que existieran los nuevos campos). El PDF que descargas es el de esa versión: 14.500€, sin consultoría, sin cronograma. El sistema NO regenera la propuesta automáticamente al guardar el presupuesto.

## Plan de fix (2 cambios pequeños + acción manual)

### Fix 1 — Auto-activar consultoría al guardar
En `ProjectBudgetPanel.handleSave`: si el usuario rellenó `monthly_fee_eur > 0` o `monthly_hours > 0` pero dejó el checkbox sin marcar, activar automáticamente `consulting_retainer.enabled = true` y mostrar un toast: *"Consultoría recurrente activada automáticamente (rellenaste cuota u horas)."*

Razón: si pones datos, claramente la quieres. Es un patrón UX defensivo.

### Fix 2 — Regenerar propuesta automáticamente al re-aprobar tras cambios
En `useProjectWizard.approveBudget`: si la última versión del Step 30 es **anterior** a la última actualización del Step 6, llamar `generateClientProposal()` automáticamente después de marcar `approved`. Toast: *"Regenerando propuesta cliente con los cambios…"*.

### Fix 3 — Banner de aviso en el panel
Cuando detectemos que `budgetData.updated_at > step30.created_at` (presupuesto editado desde la última propuesta), mostrar banner amarillo destacado:
> ⚠️ Has modificado el presupuesto. La propuesta cliente actual está desactualizada — pulsa **"Generar propuesta cliente"** para crear una nueva versión.

### Acción manual que tienes que hacer ahora (independiente del fix)
Tras desplegar los fixes:
1. Abrir el panel de presupuesto.
2. Pulsar Editar → marcar el checkbox de Activar consultoría → Guardar.
3. Pulsar **"Generar propuesta cliente"** → esto creará Step 30 v2.
4. Descargar el nuevo PDF.

Si no haces el paso 3, seguirás descargando el v1 viejo aunque el código esté corregido.

## Archivos que voy a tocar

- `src/components/projects/wizard/ProjectBudgetPanel.tsx` — auto-activar consultoría en handleSave + banner "regenera propuesta".
- `src/hooks/useProjectWizard.ts` — auto-regenerar propuesta en `approveBudget` si está stale.
- `src/main.tsx` — bump cache-bust.

No hace falta tocar la edge function (los renders ya están bien).