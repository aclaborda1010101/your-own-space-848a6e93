
# Microcorrecciones finales propuesta cliente (Step 30)

Solo se edita el renderizador de la propuesta (`f7-proposal-builder.ts`) y un saneador editorial. **No se toca pipeline, Step 28, Step 29, Build Pack ni PRD.**

---

## 1. Cabecera: "CONFIDENCIAL — AFFLUX" (no el nombre del decisor)

La cabecera ya usa `project_name`, pero el proyecto está guardado con un nombre incorrecto en BBDD (probablemente "Alejandro Gordo"). Solución doble:

- **Forzar fallback editorial** en `renderProposalMarkdown`: si `project_name` coincide con `decision_maker_name` o tiene pinta de nombre de persona, usar `client_company` (o "AFFLUX" si está disponible) para el `CONFIDENCIAL` y para el título.
- Mostrar bloque de identificación así:
  - `Cliente / empresa: AFLU / AFFLUX`
  - `Decisor: Alejandro Gordo`
  - `Proyecto / Producto: AFFLUX`
- Si `client_company` ya contiene "AFFLUX" o "AFLU", priorizarlo en cabecera y título sobre `project_name`.

## 2. Sanitizado editorial de módulos MVP / fast-follow

Añadir una función `sanitizeScopeItem(title, description)` que se aplique a `mvp_scope`, `fast_follow` y `roadmap` antes de renderizar. Reemplazos:

- **WhatsApp originación → mock controlado**
  - Título: "Gestor de WhatsApp para originación" → "Gestor de cadencias y WhatsApp mock/controlado"
  - Descripción cuando contenga "WhatsApp" + ("originación"|"envío"|"comunicaciones"): sustituir por
    > "Interfaz para planificar contactos, registrar estados y simular comunicaciones por WhatsApp, sin envío real en MVP hasta disponer de API, consentimiento y revisión legal."
  - "Monitor de cadencia de llamadas y WhatsApp" → "Monitor de cadencias de llamadas y WhatsApp" + nota "sin automatización de envío real en MVP".

- **Detector de fallecimientos**
  - Cualquier descripción que contenga "fallecimiento" + "leads" → reescribir a:
    > "Identificar eventos sucesorios relevantes para generar alertas internas revisadas por una persona antes de cualquier acción comercial."

Lista de reglas centralizada (regex + reemplazo) para que sea ampliable.

## 3. Reescritura de "Modalidad de pago" (Sección 11)

Aplicar saneado al campo `payment_terms` antes de renderizar. Reemplazos:

- Eliminar / reescribir frases que contengan: "presupuesto ajustado", "uso intensivo de herramientas de IA para la codificación", "depende 100%".
- Anteponer (o sustituir párrafo correspondiente) por:
  > "El presupuesto se plantea para una primera versión funcional por fases, apoyada en herramientas de desarrollo asistido por IA y revisión técnica del equipo. El componente Soul de Alejandro requiere una implicación activa del decisor durante las sesiones de captura de criterio; su calidad dependerá de la concreción del material aportado y de la validación de los criterios estratégicos durante las primeras semanas."
- Costes legales: si se detecta línea de DPIA/legal en `legal_notes` o `payment_terms`, reescribir a:
  > "Los costes de asesoría legal, DPIA o validación jurídica externa no están incluidos y deberán ser gestionados por el cliente en paralelo si fueran necesarios."

## 4. "Próximos pasos" como sección numerada

Cambiar la línea suelta `## Próximos pasos` por `section("Próximos pasos")` para que entre en la numeración dinámica (será `13.` o lo que toque).

## 5. Presupuesto: tabla comparativa con/sin consultoría

En la sección **Presupuesto**, cuando exista `consulting_retainer.enabled = true` y `setup_fee_before_discount`, añadir una tabla Markdown de comparación:

```text
| Concepto                       | Sin consultoría | Con consultoría IA |
|--------------------------------|-----------------|--------------------|
| Cuota inicial (desarrollo)     | 14.500 €        | 7.250 €            |
| Mensualidad recurrente         | 250 €/mes       | 250 €/mes          |
| Consultoría IA mensual         | —               | X €/mes (Y h)      |
| Total primer año (estimado)    | 17.500 €        | 10.250 € + cons.   |
```

- Importes calculados desde `setup_fee_before_discount`, `setup_fee` (con descuento), `monthly_retainer` y `consulting_retainer.monthly_fee_eur` × 12.
- Si no hay consultoría activada, mostrar solo desglose actual (sin tabla comparativa).
- Mantener bloque dedicado "Consultoría / Asesoría IA recurrente" tal cual ya existe.

## 6. Cache-bust + redeploy

- Actualizar `// cache-bust` en `src/main.tsx`.
- Redeploy de `project-wizard-step`.

---

## Detalles técnicos

**Archivos a editar:**
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts`
  - Nueva función `editorialSanitize(proposal)` invocada al inicio de `renderProposalMarkdown`.
  - Lógica de cabecera: priorizar `client_company` si contiene AFFLUX/AFLU o si `project_name` ≈ `decision_maker_name`.
  - Cambiar `lines.push("## Próximos pasos")` → `section("Próximos pasos")`.
  - Añadir helper `renderBudgetComparisonTable(budget)` y llamarlo dentro de la sección Presupuesto cuando `consultingActive`.
- `src/main.tsx` — bump `cache-bust`.

**No se modifican:**
- Step 28 (PRD), Step 29 (Build Pack), pipeline de extracción/scope.
- Schema de `ClientProposalV1`.
- Datos guardados en BBDD del proyecto.

## Acción del usuario tras aprobar

1. Ir a Step 5 → "Generar propuesta cliente" para producir la versión final.
2. Descargar PDF y validar:
   - Cabecera "CONFIDENCIAL — AFFLUX".
   - WhatsApp como mock/controlado.
   - Detector de fallecimientos con redacción suavizada.
   - Sección 11 sin frases internas.
   - "13. Próximos pasos" numerado.
   - Tabla comparativa con/sin consultoría visible en sección Presupuesto.
