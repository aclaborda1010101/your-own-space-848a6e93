

## Documento de Alcance para el Cliente (post-presupuesto)

### Qué tienes hoy

En el wizard, tras aprobar el PRD y generar el presupuesto, aparece el panel **"Propuesta para el Cliente"** con dos botones:
- **Propuesta Comercial (≤10 págs)** → step 101
- **Propuesta Completa** → step 100 (muy técnico/largo)

La 101 ya cubre: resumen ejecutivo, descripción de solución, alcance (lista plana), fases con Gantt, inversión y condiciones. **Pero** le faltan exactamente las cosas que pides:
- Tareas clasificadas por **complejidad** (simple / media / compleja)
- Listado de **IAs por tipo** (texto, voz, imagen, vídeo, OCR…) con justificación
- **Estimación de coste mensual de IA** por consultas (hoy `recurring_monthly.ai_apis` es un número opaco)
- Mejor jerarquía visual del alcance (capas / secciones), no solo una tabla plana

### Qué voy a construir

Un **tercer botón** en el panel "Propuesta para el Cliente":

> **Documento de Alcance Profesional (≤15 págs)** — `stepNumber: 102`

Pensado exactamente para entregar al cliente tras cerrar el precio. Sustituye al uso actual del 101 cuando quieras un entregable formal con detalle de IAs y costes operativos. (El 100/101 se mantienen tal cual.)

### Estructura del documento (≤15 páginas)

1. **Portada** — cliente, proyecto, fecha, versión.
2. **Resumen ejecutivo** (½ página) — qué problema resolvemos y para quién.
3. **Descripción de la solución** (1-2 págs) — narrativa entendible, sin jerga técnica.
4. **Alcance del proyecto por capas** (3-4 págs)
   - Agrupado en **secciones funcionales** (no lista plana): p.ej. *Capa de Captación*, *Capa de Inteligencia*, *Capa de Operación*, *Integraciones*.
   - Cada sección lista sus **módulos/tareas** con badge de complejidad: 🟢 Simple · 🟡 Media · 🔴 Compleja.
   - 1-2 líneas de descripción por tarea, sin SQL ni nombres de Edge Functions.
5. **Stack de Inteligencia Artificial** (2 págs)
   - Tabla de IAs usadas agrupadas por tipo: **Texto/LLM**, **Voz (STT/TTS)**, **Visión/OCR**, **Imagen generativa**, **Vídeo**, **Embeddings/RAG**.
   - Por cada IA: proveedor/modelo, dónde se usa en el proyecto, criticidad.
6. **Coste operativo mensual estimado de IA** (1 pág)
   - Tabla por servicio: volumen estimado de consultas/mes × tarifa → coste mensual.
   - Total con rango bajo / esperado / alto (escenarios).
   - Usa `src/config/projectCostRates.ts` (ya existe) como fuente de tarifas.
7. **Planificación temporal** (1-2 págs)
   - Fases con duración en semanas + **Gantt visual** (ya existe en 101).
   - Hitos y entregables por fase.
8. **Inversión** (1 pág)
   - Desglose por fase (sin horas internas ni márgenes).
   - Costes recurrentes mensuales (hosting + IA + mantenimiento) con totales.
   - Modelos comerciales seleccionados.
9. **Condiciones y próximos pasos** (½ pág).

Total objetivo: **12-15 páginas**, con cards, tablas y badges de color (mismo CSS profesional que ya usa la 101).

### De dónde sale cada dato

| Sección | Fuente |
|---|---|
| Descripción / alcance | step 3 (Alcance) + step 5 (PRD), pasados por sanitizador anti-tecnicismos ya existente (`simplifyPrd`) |
| Capas y complejidad | Re-clasificación por LLM (Gemini Pro) sobre el PRD: agrupa módulos en 4-6 capas y marca complejidad por módulo |
| Stack de IA | Auditoría IA (step 4) + manifest si existe → consolidados por una llamada LLM que normaliza por tipo (texto/voz/imagen/vídeo/visión/RAG) |
| Coste IA mensual | LLM estima volumen mensual por servicio y multiplica por `RATES` de `src/config/projectCostRates.ts` |
| Fases y timeline | `budgetData.development.phases` (ya tiene `duration_weeks` o se deriva de horas) |
| Inversión | `budgetData` filtrado en modo `client` (sin márgenes) |
| Modelos comerciales | Selección del usuario en el panel (igual que hoy) |

### Cómo se genera (sin tocar arquitectura)

1. **Botón en `ProjectProposalExport.tsx`** llama a `generate-document` con `stepNumber: 102` y `exportMode: "client"`.
2. **Nuevo bloque en `generate-document/index.ts`** (`else if (stepNumber === 102)`) que:
   - Recibe scope+PRD+auditoría+budget+monetización seleccionada.
   - Hace **una sola llamada** a `chat()` con `gemini-pro` para obtener un JSON estructurado: `{ layers: [{name, description, tasks: [{name, complexity, description}]}], ai_stack: [{type, name, model, usage, criticality}], ai_monthly_estimate: [{service, volume, unit_cost, monthly_eur}] }`.
   - Renderiza HTML profesional con badges de complejidad (verde/amarillo/rojo), tabla de IAs y tabla de costes IA.
   - Reutiliza el renderer de fases/Gantt/inversión del step 101.
3. Añade `102: "Documento de Alcance"` a `STEP_TITLES` y a `isClientFacing`.
4. El parser anti-tecnicismos (`simplifyPrd`, `sanitizeTextForClient`) ya está y se reutiliza.

### Archivos a editar/crear

- **Editar** `supabase/functions/generate-document/index.ts`:
  - Añadir `STEP_TITLES[102] = "Documento de Alcance"`.
  - Añadir `102` a `isClientFacing`.
  - Nuevo bloque `else if (stepNumber === 102) { ... }` con renderer + 1 llamada a LLM para estructurar capas/IAs/costes.
- **Editar** `src/components/projects/wizard/ProjectProposalExport.tsx`:
  - Tercer botón **"Documento de Alcance (≤15 págs)"** que llama a `buildPayload(102)`.
- **Sin migraciones**, sin tablas nuevas, sin cambios en BD.
- **Sin tocar** el panel de presupuesto, ni los flujos 100/101 actuales.

### Detalles técnicos relevantes

- Modelo: `gemini-pro` (mejor razonamiento estructural; la llamada es única y JSON).
- Tarifas IA: importadas desde `src/config/projectCostRates.ts` y duplicadas como constante en la edge function (no se puede importar `src/` desde edge).
- Cap del documento: tras render, si HTML > umbral, se trunca la sección de "Stack IA" a top-10 servicios y "Capas" a top-6 capas para asegurar ≤15 págs.
- Modo cliente estricto: misma sanitización que 101 (sin SQL, sin nombres de Edge Functions, sin "Lovable", sin RLS, sin márgenes internos).

### Resultado para ti

Tras aprobar PRD → generar presupuesto → seleccionar modelos comerciales → click en **"Documento de Alcance (≤15 págs)"** → PDF profesional listo para enviar al cliente con: solución, capas y tareas con complejidad, IAs por tipo, coste IA mensual estimado, fases con Gantt, inversión y condiciones.

