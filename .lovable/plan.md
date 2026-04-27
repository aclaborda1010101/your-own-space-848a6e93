# Bug: PDF muestra 14.500€ en vez de 12.400€ y faltan consultoría + cronograma

## Diagnóstico (lo que pasó)

Mirando tu screenshot del PDF (sección 10 "Presupuesto") y comparando con lo que tienes editado:

- En el panel: **Total desarrollo = 12.400€**, modelo "Desarrollo a Medida" con Setup = **12.400€** (panel ya sincronizado).
- Marcaste y guardaste: **Consultoría/Asesoría IA recurrente** = 3.500€/mes, 35h/mes, 50% descuento.
- Definiste: **MVP 8 semanas**, fecha arranque **04/05/2026**.
- El PDF (`fase-30-v1 (2).pdf`, página 6) muestra: Cuota inicial **14.500€**, mensual **250€**, **sin** línea de consultoría, **sin** cronograma de fases.

Causas raíz confirmadas leyendo el código:

1. **El sync setup↔total_dev es manual (botón "Sincronizar")**, no automático al editar. Tu PDF actual viene de una generación previa donde el setup todavía era 14.500€ — o el modelo recomendado sigue desincronizado en BBDD.
2. **El f7-builder SÍ renderiza** la consultoría (líneas 822-846) y el cronograma de fases (línea 760-797). Si no aparecen, es porque cuando se llamó `generate_client_proposal`, el `commercial_terms_v1` derivado **no contenía** `consulting_retainer.enabled=true` ni `implementation_override`. Esto pasa si:
   - El PDF que estás abriendo es de **antes** de marcar la consultoría / definir plazos / pulsar "Guardar".
   - O bien Guardaste pero **no volviste a pulsar "Generar propuesta cliente"** después.
3. El PDF actual es `v1` (segunda copia local). El sistema versiona, así que regenerar producirá un nuevo PDF.

## Cambios a aplicar

### 1. Sync automático real del setup_fee (no solo botón)

En `ProjectBudgetPanel.tsx`:
- Cuando el usuario edite `total_development_eur` o `hourly_rate_eur` o cualquier fase: si `isSetupSynced(prev)` era `true` (estaban acoplados), aplicar `syncSetupWithDev` automáticamente al recomputar.
- Hoy `applyDevChange` (línea 219) ya hace esto, pero solo si **antes** estaban sincronizados. El bug es que en proyectos antiguos nunca se sincronizaron, así que el botón es la única vía.
- **Fix**: en `handleSave`, si el modelo recomendado tiene `setup_price_eur` distinto al `total_development_eur`, **forzar el sync** antes de guardar (con confirmación inline del usuario o badge "se sincronizó automáticamente").

### 2. Garantizar que el `commercial_terms_v1` enviado al backend siempre incluye los nuevos campos

En `useProjectWizard.ts → generateClientProposal` (línea 1409):
- Antes de mapear, hacer un `console.info` de los campos clave: `consulting_retainer.enabled`, `implementation_override.start_date`, `setup_fee` resultante.
- Mostrar un toast de aviso si el `setup_fee` que se va a enviar al cliente difiere del `total_development_eur` del panel ("Vas a enviar 14.500€ al cliente pero tu coste real es 12.400€ — ¿continuar?").

### 3. Render obligatorio del cronograma en el PDF (incluso sin override)

El f7-builder ya genera `schedule.phases` siempre (es heurístico por defecto). El PDF actual no muestra la tabla → o la generación es vieja, o el wrapper de markdown→PDF (`generate-document/index.ts`) está perdiendo la tabla markdown.
- Revisar render de markdown → HTML en `generate-document` para confirmar que las tablas markdown del schedule se transforman correctamente.
- Añadir una sección dedicada **"11. Plazos de implementación"** entre "10. Presupuesto" y "11. Modalidad de pago", con la tabla de fases y, si hay `start_date`, fechas absolutas calculadas.

### 4. Render de la consultoría como bloque visible en el PDF

Hoy se renderiza como sub-bullet bajo "Cuota inicial". Cambiar a un bloque destacado:
- Sub-sección clara dentro de "10. Presupuesto":
  - **Consultoría / Asesoría IA recurrente:** 3.500€/mes (35h/mes incluidas)
  - **Descuento aplicado:** 50% sobre la cuota inicial
  - **Importe original:** 14.500€ → **Importe con descuento:** 7.250€
  - Notas de la consultoría (si las hay).

### 5. Aviso visible "regenera la propuesta tras editar"

En el panel, cuando se detecte que `editData` cambió respecto al último `client_proposal_v1` generado, mostrar un banner amarillo: *"Has modificado el presupuesto desde la última propuesta. Regenera la propuesta cliente para reflejar los cambios."*

## Archivos a tocar

- `src/components/projects/wizard/ProjectBudgetPanel.tsx` — sync automático en handleSave + banner de "regenera propuesta".
- `src/hooks/useProjectWizard.ts` — log + warning previo al envío.
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts` — sección dedicada cronograma + bloque consultoría destacado.
- `src/main.tsx` — bump cache-bust.

## Cómo lo verificarás tras el fix

1. Abre el panel → ya está sincronizado a 12.400€.
2. Pulsa **"Generar propuesta cliente"** de nuevo (genera v2 del PDF).
3. Abre el PDF nuevo: sección 10 debe mostrar Cuota inicial 7.250€ (12.400 × 0,5), bloque destacado de consultoría con 3.500€/mes y 35h, sección 11 con tabla de fases empezando 4 may 2026 con MVP de 8 semanas.