Cambios concretos en el bloque "11. Presupuesto" y secciones siguientes de la propuesta cliente (Step 30, deterministic).

### 1. Renombrar las dos columnas de la tabla comparativa
Archivo: `supabase/functions/project-wizard-step/f7-proposal-builder.ts` → función `renderTwoOptionBudgetTable`.
- "Opción estándar" → **"Desarrollo único"**
- "Opción con asesoría IA" → **"Desarrollo + asesoría IA"**

### 2. Mantenimiento mensual con descuento en la opción de asesoría
Hoy las dos columnas muestran el mismo coste de mantenimiento. Aplicar descuento de **80 €/mes** (250 → 170) en la opción con asesoría IA.
- Lógica: si `consulting_retainer.enabled`, columna derecha de "Coste de mantenimiento mensual" = `monthly - 80`. Si el resultado fuese ≤ 0, dejar el valor original sin descuento (defensivo).
- Esto se aplica solo en el render, no en la BD.

### 3. Eliminar la fila "Total estimado primer año"
Quitar por completo esa fila de la tabla en ambas columnas (asusta visualmente y engorda el presupuesto). 

### 4. Añadir nota de compromiso de un año
Añadir como nueva línea en el bloque `_Notas:_` justo después de las dos existentes:
- "_Compromiso mínimo de 12 meses sobre el plan de mantenimiento y, en su caso, sobre la asesoría IA._"

### 5. Recortar la sección "Asesoría e inteligencia artificial recurrente"
Mantener la cabecera y el primer párrafo (servicio mensual con N horas) y mantener la frase de "Incluye mentoría, asesoría y consultoría…". Sin tocar.

### 6. Reescribir la sección "Modalidad de pago"
Hoy mete texto largo sobre cuotas, ajustes y plan de mantenimiento. Sustituir por un texto corto y profesional, fijo:

```
**Desarrollo inicial:** 50% a la firma del contrato y 50% a la entrega del MVP.
**Mantenimiento mensual:** facturación mensual, a final de mes.
**Asesoría e inteligencia artificial (si aplica):** facturación mensual, a final de mes.

**Costes de IA / API de terceros:** estimación basada en el uso esperado. El coste real puede variar y se facturará de forma transparente según consumo real.
```

Esto reemplaza tanto el `payment_terms` como cualquier frase residual sobre "plan de mantenimiento incluye N horas" o "se ajustará la cuota mensual si el uso excede". Implementación: nueva función `buildClientPaymentTermsBlock()` que devuelve este texto fijo y se usa siempre que haya `consulting_retainer` o `monthly_retainer`. Mantener el saneador para casos antiguos.

### 7. Cache-bust y test
- Bump `// cache-bust:` en `src/main.tsx`.
- Actualizar `f7-proposal-builder_test.ts`:
  - Comprobar nuevas etiquetas "Desarrollo único" / "Desarrollo + asesoría IA".
  - Comprobar que **NO** aparece "Total estimado primer año".
  - Comprobar mantenimiento descontado (170 €/mes cuando estándar = 250 € y consulting activo).
  - Comprobar el bloque nuevo de Modalidad de pago con "50% a la firma" y "a final de mes".
  - Comprobar nota de compromiso de 12 meses.

### Archivos modificados
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts`
- `supabase/functions/project-wizard-step/f7-proposal-builder_test.ts`
- `src/main.tsx`

### Validación
Tras aprobar: refrescar, en Paso 5 pulsar "Regenerar propuesta cliente" y descargar PDF. La sección 11 debe mostrar la tabla con las dos columnas renombradas, mantenimiento 170 €/mes en la columna derecha, sin total anual, y la nota de compromiso 12 meses. La modalidad de pago debe ser exactamente el bloque corto definido arriba.