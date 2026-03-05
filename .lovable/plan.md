

## Diagnóstico: El briefing se extrajo pero no se muestra

### Causa raíz
Gemini Flash devolvió el JSON del briefing envuelto en algo que hizo fallar `JSON.parse` (probablemente backticks u otros caracteres). Cuando falla, la edge function guarda `{ raw_text: "...", parse_error: true }` en lugar del objeto JSON parseado. 

El componente `ProjectWizardStep2` recibe ese objeto como `briefing`, pero como no tiene los campos esperados (`resumen_ejecutivo`, `objetivos`, etc.), muestra todo vacío — las secciones existen pero sin datos.

Irónicamente, el campo `raw_text` **sí contiene JSON válido** que podría parsearse.

### Plan de corrección (2 cambios)

**1. Edge Function — Parsing más robusto (`project-wizard-step/index.ts`, líneas ~340-350)**

Mejorar la lógica de limpieza del JSON antes de parsear:
- Eliminar posibles prefijos/sufijos markdown más agresivamente (regex para cualquier bloque de código)
- Si el primer parse falla, intentar extraer el JSON buscando el primer `{` y último `}` en el texto
- Si aún falla, guardar `raw_text` como ahora pero intentar un parse del `raw_text` antes de rendirse

**2. Componente UI — Recuperación de `raw_text` (`ProjectWizardStep2.tsx`, líneas ~76-81)**

En el `useEffect` que inicializa `editedBriefing`, detectar si `briefing.parse_error === true` y `briefing.raw_text` existe:
- Intentar `JSON.parse(briefing.raw_text)` 
- Si funciona, usar ese objeto como briefing y actualizar el step en la DB con el objeto parseado
- Mostrar un toast informativo "Briefing recuperado desde texto sin procesar"

**3. Fix inmediato para el proyecto actual**

Ejecutar un UPDATE en la DB para parsear el `raw_text` que ya existe y guardarlo correctamente, para que el briefing se muestre sin necesidad de regenerar.

### Redeploy
Redesplegar `project-wizard-step` con el parsing mejorado.

