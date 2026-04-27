Voy a corregirlo para que el botón “Regenerar propuesta cliente” sea autosuficiente: si ya tienes modelos, precios, consultoría y plazos definidos/aprobados, debe reconstruir la propuesta desde esos datos actuales y guardarla como nueva versión visible, sin obligarte a rehacer todo el presupuesto.

## Diagnóstico

El fallo actual no es que falten datos. La propuesta sí se genera, pero el frontend la bloquea porque detecta una frase considerada “obsoleta”: `Opción con asesoría IA`.

El problema concreto es doble:

1. El generador backend ya usa un texto parecido en la nueva tabla: `Desarrollo + asesoría IA` y también una nota `La opción con asesoría IA...`.
2. El frontend tiene un detector demasiado agresivo que considera cualquier mención a “opción con asesoría IA” como texto antiguo, aunque la propuesta se haya regenerado bien.

Resultado: pulsas regenerar, se crea/actualiza Step 30, pero la UI te dice que contiene textos antiguos y te manda a refrescar, creando un bucle inútil.

## Plan de cambios

1. **Quitar el falso positivo del frontend**
   - Ajustar `src/hooks/useProjectWizard.ts` para que no marque como obsoleta la frase genérica `Opción con asesoría IA` cuando viene de la nueva propuesta.
   - Mantener bloqueos solo para textos realmente antiguos o incorrectos.

2. **Limpiar el copy del backend para evitar confusión**
   - En `supabase/functions/project-wizard-step/f7-proposal-builder.ts`, cambiar frases ambiguas como “La opción con asesoría IA...” por una redacción nueva tipo:
     - “La modalidad con acompañamiento IA aplica...”
   - Mantener la tabla comparativa con precios, consultoría, mantenimiento y plazos.

3. **Forzar recarga de build de Lovable**
   - Actualizar `src/main.tsx` con nuevo `cache-bust` para que el preview no siga usando código anterior.

4. **Verificación técnica**
   - Ejecutar TypeScript para confirmar que no rompe compilación.
   - Desplegar la Edge Function `project-wizard-step` para que el backend use el nuevo builder.

## Resultado esperado

Después del cambio, al pulsar **Regenerar propuesta cliente**:

- No tendrás que rehacer ni reaprobar todo el presupuesto.
- Se leerá el presupuesto actual aprobado desde Supabase.
- Se aplicarán precios, consultoría, plazos y modelos actuales.
- Se actualizará Step 30 incrementando versión.
- La UI mostrará éxito en vez del error falso de “textos antiguos”.

## Archivos a tocar

- `src/hooks/useProjectWizard.ts`
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts`
- `src/main.tsx`