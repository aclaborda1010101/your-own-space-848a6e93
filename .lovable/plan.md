# Plan: Presupuesto con dos opciones claras (Estándar vs. Con asesoría IA)

## Objetivo
Arreglar definitivamente la sección 10 de la propuesta cliente para que muestre **dos opciones de presupuesto en tabla**, con terminología limpia, y eliminar el problema de datos obsoletos (14.500€ / "mensualidad recurrente").

## Cambios

### 1. `supabase/functions/project-wizard-step/f7-proposal-builder.ts`
- Reemplazar Sección 10 completa por una tabla Markdown comparativa:

  | Concepto | Opción estándar | Opción con asesoría IA |
  |---|---|---|
  | Coste de desarrollo inicial | 12.400 € | **6.200 €** (50% dto.) |
  | Coste de mantenimiento mensual | 215 € | 215 € |
  | Asesoría e inteligencia artificial (35 h/mes) | — | 3.500 €/mes |
  | **Total estimado primer año** | 14.980 € | 50.780 € |

- Notas debajo de la tabla:
  - "Costes de IA / API de terceros no incluidos, facturados según consumo real."
  - "IVA no incluido."
  - "La opción con asesoría aplica un 50% de descuento sobre el desarrollo inicial a cambio del compromiso anual de consultoría."
- Eliminar de Sección 11 cualquier mención a "presupuesto ajustado", "uso intensivo de IA" y similares; sustituir por lenguaje neutro de fases de pago.

### 2. `supabase/functions/project-wizard-step/index.ts`
- Confirmar que `commercialTermsFromBudgetData` lee SIEMPRE de la fila más reciente de Step 6 en BD e ignora el payload del cliente para evitar valores obsoletos.

### 3. `src/components/projects/wizard/ProjectProposalExport.tsx` + `useProjectWizard.ts`
- Forzar regeneración fresca al pulsar "Generar propuesta cliente" (no reutilizar el último PDF cacheado si las cifras del Step 6 han cambiado).

### 4. `f7-proposal-builder_test.ts`
- Test que falla si el output contiene "14.500", "14,500", "Cuota inicial" o "Mensualidad recurrente".
- Test que verifica presencia de la tabla y de ambas opciones (12.400 € y 6.200 €).

### 5. `src/main.tsx`
- Actualizar `cache-bust` timestamp.

## Acción del usuario tras desplegar
1. Refrescar navegador.
2. Step 4 → guardar y aprobar presupuesto.
3. Step 5 → "Generar propuesta cliente" → descargar PDF.
