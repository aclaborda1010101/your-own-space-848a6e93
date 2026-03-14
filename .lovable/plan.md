
Diagnóstico confirmado (con evidencia):
- El bug no es de IA/modelo: en logs el PRD sí se genera en background (`[PRD] Background generation completed successfully`).
- El problema es de numeración/mapeo:
  - `run_ai_leverage` aún guarda en `step_number = 6` (no en 4).
  - `generate_prd` aún guarda en `step_number = 7` (no en 5).
  - En frontend, el paso 6 (MVP) toma primero `step_number = 6`, así que “hereda” la Auditoría IA.
- Resultado práctico:
  1) Al aprobar Auditoría IA, también parece activarse MVP (porque comparten el 6 en DB).
  2) Al generar PRD desde paso 5, `clearSubsequentSteps(5)` borra `step_number > 5`, incluyendo la auditoría guardada en 6; por eso “vuelve” a auditoría como si no estuviera hecha.

Plan de corrección (implementación):
1) Alinear contrato de pasos en backend (`supabase/functions/project-wizard-step/index.ts`)
- `run_ai_leverage` -> `step_number: 4`.
- `generate_prd` (bloque async completo) -> `step_number: 5` en:
  - creación estado `generating`,
  - update final a `review`,
  - guardado en `project_documents`,
  - `recordCost`,
  - `business_projects.current_step`.
- Mantener MVP en `step_number: 11` (sin colisionar con presupuesto interno).

2) Corregir resolución de pasos en frontend (`src/hooks/useProjectWizard.ts`)
- Rehacer el mapeo de carga para que sea explícito por paso UI y evite colisiones:
  - Paso 4 (Auditoría IA): preferir DB 4; fallback legacy 6 solo si el registro es realmente Auditoría IA.
  - Paso 5 (PRD): preferir DB 5; fallback legacy 7.
  - Paso 6 (MVP): usar DB 11 (quitar prioridad sobre 6).
- Ajustar `pollForStepCompletion`:
  - Paso 4 -> `[4,6]` (retrocompat).
  - Paso 5 -> `[5,7]` (retrocompat).
  - Paso 6 -> `[11]` (evitar falsos positivos con 6).
- Ajustar `mapOldStepNumber`/normalización de `current_step` para que no degrade pasos nuevos (evitar mapeos ambiguos que rompen navegación).

3) Endurecer aprobación retrocompatible (`approve_step` en edge function)
- Resolver `dbStepNumber` con criterio de paso real:
  - UI 4: 4 o legacy 6 (Auditoría IA).
  - UI 5: 5 o legacy 7 (PRD).
  - UI 6: 11.
- Evitar que UI 6 intente aprobar `step_number = 6`.

4) Parche de datos existentes (migración de contenido ya roto)
- Ejecutar migración de normalización para no dejar proyectos “a medias”:
  - mover Auditoría IA legacy (6) a 4 cuando corresponda,
  - mover PRD legacy (7) a 5 cuando corresponda,
  - preservar `step_number = 6` para presupuesto interno.
- Objetivo: que proyectos actuales no requieran rehacer pasos manualmente.

5) Validación funcional (E2E)
- Caso exacto reportado:
  1) Generar Auditoría IA,
  2) Aprobar Auditoría IA,
  3) Verificar que queda habilitado PRD (no MVP),
  4) Generar PRD,
  5) Confirmar que no regresa a Auditoría IA y que PRD queda en `review/approved`,
  6) Luego generar MVP y confirmar guardado en DB 11.
- Validación retrocompat:
  - abrir proyecto legacy con pasos 6/7 y confirmar lectura correcta sin colisiones visuales.

Detalles técnicos clave:
- Archivos a tocar:
  - `supabase/functions/project-wizard-step/index.ts`
  - `src/hooks/useProjectWizard.ts`
- Causa raíz estructural: colisión de `step_number=6` entre Auditoría IA, MVP (resolución frontend) y presupuesto interno.
- Criterio final de contrato:
  - UI 4 = DB 4 (legacy 6),
  - UI 5 = DB 5 (legacy 7),
  - UI 6 = DB 11,
  - DB 6 reservado a presupuesto interno.
