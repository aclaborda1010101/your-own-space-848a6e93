He localizado el fallo real. No es solo el texto del presupuesto.

Ahora mismo pasa esto:

1. El PDF que has subido contiene exactamente la versión antigua:
   - “Cuota inicial: 14.500 EUR”
   - “Mensualidad recurrente: 250 EUR”
   - “El presupuesto de desarrollo es ajustado...”
   - “uso intensivo de herramientas de IA...”

2. En la base de datos, para el proyecto AFFLUX, ya NO existe Step 30 generado con propuesta cliente. La tabla `project_wizard_steps` solo tiene steps 1, 2, 3, 6 y 11. Es decir: el documento correcto no se está guardando o se está borrando después.

3. He encontrado el borrado: al pulsar el módulo opcional “Descripción MVP” se llama a `runGenericStep(4, "generate_mvp")`, y esa función ejecuta `clearSubsequentSteps(4)`. Esa limpieza borra cualquier step con número superior a 4, incluido:
   - Step 30: propuesta cliente nueva
   - Step 28/29: scope/PRD pipeline v2
   - otros steps internos
   Preserva solo Step 6. Por eso puedes “regenerar todo” y acabar descargando otra vez un PDF antiguo de Storage (`/30/vv1.pdf`) que sigue ahí con la versión vieja.

4. Además hay otro problema: el generador de documentos guarda Step 30 como `30/vv1.pdf` porque recibe `version: "v1"` y luego añade otra `v`. Ese path se sobrescribe/reutiliza y facilita que parezca que todo sigue igual.

## Plan de corrección definitiva

### 1. Blindar Step 30 contra borrados accidentales
Modificar `clearSubsequentSteps` en `src/hooks/useProjectWizard.ts` para que NO borre steps internos/canónicos cuando se regenera la descripción MVP opcional.

Concretamente:
- Si se regenera Step 4 visual/MVP opcional, no se borrarán Step 6, 25, 26, 27, 28, 29, 30, 31, 32 ni 300.
- La descripción MVP quedará como opcional y no destructiva.

### 2. Corregir el mapeo de steps para evitar que Step 11 suplante al Step 4
Ahora Step 11 aparece como “Descripción del MVP” y dispara el flujo de limpieza equivocado. Ajustaré el loading/mapping para que:
- El Step 4 visual use Step 4 real si existe.
- Step 11 se trate como interno/legacy y no como trigger para borrar entregables posteriores.

### 3. Forzar que “Generar propuesta cliente” cree y cargue un Step 30 real
En `generateClientProposal`:
- Después de invocar `project-wizard-step`, validar que existe una fila Step 30 nueva.
- Si no existe, mostrar error explícito en vez de permitir descargar un PDF anterior.
- Cargar la propuesta directamente desde la fila Step 30 recién creada, no desde estado viejo.

### 4. Bloquear descarga si la propuesta contiene texto antiguo
En `ProjectProposalExport.tsx` antes de descargar:
- Si `proposalMarkdown` contiene “Cuota inicial”, “Mensualidad recurrente”, “14.500”, “14,500” o “presupuesto de desarrollo es ajustado”, bloquear la descarga con un error claro.
- Esto evita que vuelva a salir un PDF viejo aunque quede cacheado.

### 5. Añadir autocorrección en `generate-document` para Step 30
En `supabase/functions/generate-document/index.ts`:
- Si `stepNumber === 30` y `exportMode === "client"`, ignorar contenido stale del frontend si existe un Step 30 más reciente en BD.
- Renderizar siempre `output_data.proposal_markdown` de la última fila Step 30.
- Si no hay Step 30, devolver error: “No existe propuesta cliente actual; pulsa Generar propuesta cliente”.
- Cambiar el nombre/path para no generar `vv1.pdf`.

### 6. Corregir el presupuesto de dos opciones en la fuente de verdad
Mantener y reforzar `f7-proposal-builder.ts` para que Section 10 sea siempre:

| Concepto | Opción estándar | Opción con asesoría IA |
|---|---|---|
| Coste de desarrollo inicial | coste completo | 50% del desarrollo |
| Coste de mantenimiento mensual | mismo mantenimiento | mismo mantenimiento |
| Asesoría e inteligencia artificial | — | importe mensual según horas |
| Total estimado primer año | desarrollo + 12 mantenimiento | 50% desarrollo + 12 mantenimiento + 12 asesoría |

Y eliminar definitivamente del render:
- “Cuota inicial”
- “Mensualidad recurrente”
- “presupuesto ajustado”
- “uso intensivo de IA para la codificación”

### 7. Regenerar y validar AFFLUX
Después de aplicar cambios:
- Ejecutar tests de F7.
- Generar Step 30 para el proyecto AFFLUX desde la Edge Function.
- Verificar en BD que existe Step 30 y que su markdown contiene la tabla correcta.
- Generar el PDF nuevo y confirmar que ya no contiene los textos antiguos.

## Resultado esperado
El próximo PDF de AFFLUX no saldrá de Storage antiguo ni del Step 11/MVP opcional. Saldrá exclusivamente de Step 30 actualizado, con la tabla comparativa correcta y con bloqueo si aparece cualquier frase antigua.