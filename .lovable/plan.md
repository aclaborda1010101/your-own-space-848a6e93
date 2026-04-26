
# Simplificación del wizard de proyecto

Diagnóstico de lo que ves hoy en `/projects/wizard/:id` vs lo que debería verse según tu feedback.

---

## 1. Sidebar izquierda (ProjectWizardStepper) — quitar ruido interno

**Hoy:** la sidebar muestra 8 fases:
`Entrada · Briefing · Alcance · Auditoría IA · Patrones · PRD Técnico · Descripción MVP · Expert Forge`

**Problema:** `Alcance`, `Auditoría IA` y `Patrones` son fases internas del pipeline v2 que se ejecutan automáticamente al pulsar "Generar PRD Técnico (v2)" (steps 25→26→27→28→29 en el backend). El usuario no debe verlas como pasos clicables.

**Cambio:** dejar la sidebar con sólo 5 fases visibles:

```
1. Entrada
2. Briefing
3. PRD Técnico         ← engloba alcance/auditoría/patrones internamente
4. Presupuesto         ← antes era "Descripción MVP" (ver punto 4)
5. Propuesta cliente   ← antes era el dialog de Expert Forge separado
```

Internamente el `ChainedPRDProgress` ya muestra el sub-progreso (alcance / auditoría / patrones / PRD), así que no se pierde visibilidad cuando está corriendo — pero deja de ser una lista de "pasos" del usuario.

**Archivos:**
- `src/components/projects/wizard/ProjectWizardStepper.tsx`: reducir `PIPELINE_PHASES` a esas 5 entradas. Mantener la lógica de `chainedPhase` para que durante la generación del PRD se muestre el spinner en la fila "PRD Técnico" sin desglose.

---

## 2. Paso 4 — Quitar el bloque "Exportar Presupuesto a PDF"

**Hoy:** dentro de `ProjectBudgetPanel.tsx` (líneas 809–897) hay un bloque completo con:
- Toggle "Cliente / Interno"
- Checkboxes de modelos
- Botón "Exportar PDF Cliente" / "Exportar PDF Interno"

**Problema:** al cliente nunca se le entrega el presupuesto suelto, se le entrega la propuesta. Este bloque sólo confunde.

**Cambio:**
- Eliminar todo el bloque (líneas 809–897).
- Eliminar también los imports/estado asociados que queden huérfanos (`selectedExportModels`, `budgetExportMode`, `exportingPdf`, `handleExportPdf`, `Lock`, `Users`, etc., revisando que no se usen en otro sitio del panel).

**Resultado:** el Paso 4 queda con generar / editar / aprobar el presupuesto. Punto.

---

## 3. Paso 5 — "Propuesta cliente" ya existe como `ProjectProposalExport`

Ya se renderiza correctamente debajo del Paso 4 cuando hay budget + PRD (`ProjectWizard.tsx` líneas 438–459) y tiene los dos botones que pediste:
- "Generar propuesta cliente"
- "Descargar propuesta cliente PDF"

**Cambio menor:** que el título del card sea claramente **"Paso 5 · Propuesta cliente"** (ya lo es) y que sea el lugar donde **también** vive el botón de Expert Forge (ver punto 5). Sin tocar la lógica de F7 que acabamos de arreglar.

---

## 4. ¿Qué pasa con "Descripción MVP" (paso 4 actual)?

**Hoy:** es un step del wizard con su propio botón "Generar Descripción MVP". Tu mensaje dice "déjala si quieres".

**Propuesta:** moverla al panel **"Avanzado / Interno"** (ya colapsado por defecto) como bloque opcional, y que el "Paso 4" visible en la sidebar pase a ser **Presupuesto** (que es lo que el usuario realmente hace después del PRD). Así:

- Sidebar: Entrada → Briefing → PRD → Presupuesto → Propuesta cliente.
- Header / progress: `currentStep` 1..5 con esos labels.
- "Descripción MVP" sigue existiendo en backend (step 4 de DB) pero como herramienta interna, no como paso obligatorio del flujo comercial.

Si prefieres dejarla como paso visible, dilo y la mantengo en la sidebar como paso 4 y el Presupuesto sería paso 5 y la Propuesta paso 6. Mi recomendación es la primera (más limpio), pero es decisión tuya — pregunto en la sección final.

---

## 5. Expert Forge — moverlo al Paso 5 (Propuesta cliente)

**Hoy:** el botón "Publicar en Expert Forge" está dentro del `CollapsibleCard` "Avanzado / Interno", colapsado por defecto. Por eso no lo ves desde fuera.

**Cambio:** sacarlo del bloque interno y meterlo dentro del card de Paso 5 (`ProjectProposalExport`) como un tercer botón al lado de "Generar / Descargar propuesta", con el copy:

> Una vez aprobada la propuesta, publica el proyecto en Expert Forge para materializar los componentes (RAGs + especialistas).

Quedaría:
- Generar propuesta cliente
- Descargar propuesta cliente PDF
- **Publicar en Expert Forge** (deshabilitado hasta que la propuesta esté generada)

Mantiene el `PublishToForgeDialog` y `ManifestViewer` que ya existen, sólo cambia el sitio donde se invocan.

---

## 6. Panel "Avanzado / Interno" — mantener para QA

El `PipelineQAPanel` con los botones de cada subpaso (build_registry, audit_f4a, audit_f4b, architect_scope, generate_technical_prd, generate_client_proposal, audit_final_deliverables) **se queda dentro del CollapsibleCard "Avanzado / Interno"** colapsado por defecto. Es la herramienta que usamos para depurar cuando algo sale mal (como esta semana). No estorba porque está plegado.

Mismo trato para:
- `ProjectDocumentsPanel` (descarga histórica de documentos por step)
- `ProjectActivityTimeline`
- `ManifestViewer`

---

## Resumen de archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/components/projects/wizard/ProjectWizardStepper.tsx` | Reducir `PIPELINE_PHASES` a 5 fases visibles y mapear los DB-steps correctos |
| `src/components/projects/wizard/ProjectBudgetPanel.tsx` | Eliminar bloque "Exportar Presupuesto a PDF" (líneas 809–897) y limpiar estado huérfano |
| `src/components/projects/wizard/ProjectProposalExport.tsx` | Añadir botón "Publicar en Expert Forge" + integrar `PublishToForgeDialog` |
| `src/pages/ProjectWizard.tsx` | Actualizar `stepLabels`, `TOTAL_STEPS`, mover Expert Forge fuera de "Avanzado / Interno", recolocar "Descripción MVP" según decisión del punto 4 |

No se toca:
- Backend / edge functions (F0–F7 quedan igual, ya está corregido)
- Lógica de `useProjectWizard.ts`
- Lógica del pipeline encadenado (`chainedPhase`, `prdSubProgress`)
- `PipelineQAPanel` (sigue como herramienta interna)

---

## Pregunta antes de implementar

**Sobre "Descripción MVP" (step 4 actual del wizard):**
- (a) Sacarlo de la sidebar y dejarlo solo en "Avanzado / Interno" como bloque opcional. La sidebar queda en 5 pasos limpios.
- (b) Mantenerlo como paso visible. La sidebar pasa a 6 pasos: Entrada · Briefing · PRD · Descripción MVP · Presupuesto · Propuesta cliente.

Mi recomendación: **(a)**, porque la "Descripción MVP" se solapa con lo que el PRD técnico y la propuesta cliente ya describen, y es lo que estaba haciendo que el flujo se vea recargado.

Cuando apruebes el plan, pásame también qué opción prefieres del punto 4 y lo implemento de un tirón.
