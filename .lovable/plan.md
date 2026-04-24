

## Exportar y revisar los prompts del pipeline de proyectos

### Objetivo
Generar un documento Markdown único con **todos los prompts** del pipeline del wizard (Brief → Alcance → Auditoría IA → Pattern Detector → PRD), copiados literalmente desde el código, anotados con su ubicación exacta (archivo + líneas) para que puedas revisarlos cómodamente y proponer mejoras.

### Entregable
Un fichero `/mnt/documents/prompts-pipeline-proyectos.md` con esta estructura:

1. **Tabla de contenidos** con un enlace por fase.
2. **Por cada fase:**
   - Persona, modelo, temperatura, max tokens.
   - Ubicación (`archivo:líneas`).
   - **System prompt completo** (literal).
   - **User prompt completo** (literal, con marcadores `${variable}` visibles).
   - Schema/output esperado.
   - Inputs que recibe (qué fases previas alimentan a esta).
3. Fases incluidas:
   - **F1 — Brief** (extract, líneas 167-445)
   - **F2 — Alcance v1 single-shot** (generate_scope, líneas 566-840)
   - **F3 — Alcance v2 encadenado** (líneas 892-1155)
   - **F4 — Auditoría IA / AI Leverage** (líneas 1167-1620 y 3066-3112)
   - **F5 — Auditoría cruzada del Alcance** (líneas 2982-3037)
   - **F6 — Pattern Detector** (resumen + referencia a `pattern-detector-pipeline`)
   - **F7 — PRD Low-Level (Partes 1-5)** (líneas 1853-2350+)
   - **F8 — Reescritura con correcciones** (3039-3064)
   - **F9 — MVP Blueprint** (3114-3172)
   - **F10 — RAG Engineering** (3175-3188)
4. **Anexo: contracts.ts** — el bloque `buildContractPromptBlock(N)` que se inyecta dinámicamente en varios prompts.
5. **Anexo: hallazgos para mejora** — basado en la lectura, una lista breve de puntos donde veo margen real:
   - Límites de extracción del Brief (15/10/8) posiblemente bajos.
   - Coexistencia de dos prompts de Alcance (riesgo de divergencia).
   - Falta de fórmula explícita de Quick Wins en Auditoría IA.
   - Persona del PRD podría separar arquitecto de PM para reducir contaminación.
   - El check final del PRD se ejecuta dentro de cada parte, no de forma global.

### Cómo lo voy a generar
Script de Python que lee `supabase/functions/project-wizard-step/index.ts` y `contracts.ts`, extrae los rangos de líneas anotados, y los compone en el `.md` con formato consistente. Sin LLM — extracción mecánica para garantizar fidelidad al código.

### Después
Tú lees el `.md`, marcas con comentarios qué prompts quieres mejorar, y en una segunda iteración aplico los cambios al código fuente con `code--line_replace`.

### Notas
- No se modifica ningún prompt en este paso. Sólo lectura y exportación.
- Pattern Detector tiene su propio archivo (`pattern-detector-pipeline/index.ts`) — lo añado al mismo `.md` para tenerlo todo en un solo sitio.

