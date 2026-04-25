# Plan — desbloquear Brief Limpio, aprobación y avance a PRD/MVP de forma global

## Diagnóstico verificado

En el proyecto actual AFFLUX (`6ef807d1-...`) la base de datos muestra:

- Step 2 existe solo como `version = 3`, `status = review`.
- No existe `output_data._clean_brief_md`.
- No existe `output_data._normalization_log`.
- Sigue habiendo `failed_chunks = [CHUNK-003]`.
- `business_projects.company = "Alejandro Gordo"`, por eso la normalización no puede inferir bien empresa vs fundador si usa `companyName` como fuente.
- `business_projects.current_step = 3`, pero Step 2 no está aprobado y no hay Step 3 generado. Esto deja la UI en un estado incoherente: parece que se avanzó, pero no hay base real para PRD/MVP.

Además, los logs recientes de `project-wizard-step` no muestran llamadas a `normalize_brief` ni `retry_failed_chunks`, lo que confirma que el botón no está dejando una versión nueva persistida.

## Objetivo global

Que cualquier proyecto con Step 2 crudo pueda repararse sin quedarse bloqueado:

1. `Limpiar y normalizar` debe generar y persistir `_clean_brief_md` sí o sí, o mostrar un error real accionable.
2. El PDF no debe quedar bloqueado para siempre por faltar `_clean_brief_md`; debe poder generar el Brief Limpio al vuelo.
3. `Aprobar briefing` debe aprobar la última versión real de Step 2 y desbloquear/generar PRD correctamente.
4. El sistema debe corregir estados incoherentes (`current_step=3` sin Step 2 aprobado / sin Step 3).
5. Las correcciones serán globales, no específicas de AFFLUX.

## Cambios propuestos

### 1. Backend: convertir normalización en operación robusta y persistente

En `supabase/functions/project-wizard-step/index.ts`:

- Reforzar `normalize_brief` para que:
  - Acepte `projectId` tanto en `body.projectId` como en `stepData.projectId`.
  - Lea siempre la última versión Step 2.
  - Si hay chunks fallidos, no falle silenciosamente: los registra en `_normalization_log.pending_failed_chunks` y aun así genera un brief limpio provisional sin volcar debug.
  - Inserte una nueva versión `step_number=2`, `status=review`, con `_clean_brief_md`, `_clean_brief_sections` y `_normalization_log`.
  - Devuelva `success: true`, `version`, `clean_brief_length`, `normalization_changes`.

- Añadir logs explícitos:
  - `[normalize_brief] start`
  - `[normalize_brief] loaded step2 vX`
  - `[normalize_brief] saved step2 vY clean_len=...`
  - `[normalize_brief] error ...`

Esto permitirá saber si el botón realmente ejecutó o dónde falla.

### 2. Backend: acción única de reparación del Step 2

Añadir una acción global nueva en `project-wizard-step`:

`action: "repair_step2_brief"`

Flujo:

```text
latest Step 2
  -> si hay failed chunks e inputContent disponible: retry_failed_chunks
  -> normalize_brief
  -> buildCleanBrief
  -> guardar nueva versión review
  -> devolver briefing limpio
```

Uso:

- El botón `Limpiar y normalizar` llamará a esta acción, no solo a `normalize_brief`.
- El botón PDF podrá llamar a esta acción si falta `_clean_brief_md`.
- Será global para proyectos antiguos o estados intermedios.

Si el retry falla, la acción no bloquea todo: genera Brief Limpio provisional, sin mostrar `FAILED CHUNKS` en PDF, y marca el pendiente en el log interno.

### 3. Frontend: botón `Limpiar y normalizar` con estado propio y actualización inmediata

En `src/hooks/useProjectWizard.ts`:

- Separar `normalizing` de `generating`, para que la UI no parezca que “no hace nada”.
- `normalizeBrief()` pasará a llamar a `repair_step2_brief`.
- Tras respuesta exitosa:
  - actualizar `steps` localmente con el `briefing` devuelto;
  - llamar a `loadProject()`;
  - mostrar toast claro: `Brief Limpio generado. PDF y aprobación desbloqueados.`
- Si falla, mostrar el mensaje real del backend, no un error genérico.

En `src/components/projects/wizard/ProjectWizardStep2.tsx`:

- Añadir estado visual en el botón:
  - `Limpiando...`
  - spinner
  - disabled solo mientras está ejecutando.
- Mostrar una caja de estado:
  - `Brief crudo pendiente de normalizar`
  - `Brief Limpio listo`
  - `Hay chunks pendientes, se generará versión limpia provisional`

### 4. PDF: auto-reparar antes de exportar si falta el Brief Limpio

En `ProjectDocumentDownload` o en Step 2:

- Para `stepNumber === 2`, si falta `_clean_brief_md`, el botón no debe quedarse muerto.
- Cambiar de `PDF (genera primero)` deshabilitado a:
  - `Generar Brief Limpio y PDF`
- Al hacer clic:
  - llamar a `repair_step2_brief`;
  - actualizar contenido local;
  - invocar `generate-document` con el Step 2 ya limpio.

En `supabase/functions/generate-document/index.ts`:

- Mantener la rama Step 2 que prioriza `_clean_brief_md`.
- Si no existe, usar fallback mínimo de 1-2 páginas, nunca JSON crudo ni tablas enormes.
- El PDF final debe salir en castellano, corto, con estructura de Brief Limpio.

### 5. Aprobación Step 2 y avance a PRD: corregir incoherencias

En `useProjectWizard.ts` / `approveStep`:

- Antes de aprobar Step 2:
  - si falta `_clean_brief_md`, ejecutar `repair_step2_brief` automáticamente;
  - aprobar la versión limpia recién creada, no la versión cruda anterior.
- Corregir el estado local para que no ocurra `current_step=3` sin Step 2 aprobado.
- Después de aprobar Step 2:
  - navegar a Step 3;
  - lanzar `runChainedPRD` si auto-chain está activado;
  - si auto-chain está apagado, dejar visible el botón `Generar PRD Técnico`.

En `project-wizard-step` acción `approve_step`:

- Evitar `.update(...).order(...).limit(1)` como patrón ambiguo.
- Buscar explícitamente el `id` de la última versión del step y actualizar por `id`.
- Para Step 2, si hay varias versiones, aprobar solo la última.

### 6. Reparación de datos del proyecto actual AFFLUX

Una vez aprobado el plan y ya en modo edición:

- Ejecutar la reparación sobre AFFLUX usando el mismo flujo global (`repair_step2_brief`).
- Corregir `business_projects.current_step` si sigue incoherente.
- No hardcodear AFFLUX en el código. Solo usar AFFLUX como caso de saneamiento puntual tras desplegar la lógica global.

### 7. Warning React de `ProjectDocumentDownload`

El warning actual indica que `ProjectDocumentDownload` recibe refs desde un wrapper tipo Radix/Tooltip/Collapsible.

- Convertir `ProjectDocumentDownload` a `React.forwardRef<HTMLButtonElement, Props>`.
- Pasar el ref al `<Button>` interno.

No parece la causa principal del bloqueo, pero limpia ruido y evita fallos de interacción con componentes `asChild`.

### 8. Cache-bust de preview

Actualizar `src/main.tsx` con nuevo `// cache-bust: ...` para forzar que la preview cargue el bundle nuevo inmediatamente.

## Criterios de aceptación

- Al pulsar `Limpiar y normalizar`, aparece spinner/estado y se guarda una nueva versión Step 2 con `_clean_brief_md`.
- El botón PDF deja de estar muerto: si falta limpieza, la genera y luego exporta.
- PDF Step 2: 3-7 páginas, en castellano, sin `FAILED CHUNKS`, sin JSON crudo, sin tablas gigantes.
- `Aprobar briefing` no aprueba la versión cruda si falta Brief Limpio; primero repara y luego aprueba.
- Tras aprobar Step 2, se puede generar PRD y avanzar hacia MVP.
- El estado `current_step` queda coherente con los steps aprobados/generados.
- La solución aplica a todos los proyectos, no solo a AFFLUX.