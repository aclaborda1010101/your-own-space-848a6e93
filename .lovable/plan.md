

## Plan: Fix truncamiento PRD (2 llamadas secuenciales)

### Estado actual

**Parte B (documentos descargables) ya está implementada**: la edge function `generate-document`, los componentes `ProjectDocumentDownload` y `ProjectDocumentsPanel`, los botones de descarga en cada paso, y el bucket de Storage ya existen. No hay nada que hacer aquí.

**Parte A (truncamiento PRD)** es el único cambio pendiente. Actualmente el PRD (Fase 7) usa Gemini Flash con una sola llamada y `maxOutputTokens: 16384`. Para PRDs largos, el output se corta.

### Cambio: Split PRD en 2 llamadas secuenciales

**Archivo**: `supabase/functions/project-wizard-step/index.ts`

En el bloque `if (action === "generate_prd")` (actualmente dentro del handler genérico en línea ~553-566), extraerlo del flujo genérico y darle su propio handler con 2 llamadas:

1. **Llamada 1**: Genera secciones 1-4 (Visión, Personas, Arquitectura, Funcionalidades P0). Añadir al prompt: "Genera SOLO secciones 1-4. Termina con `---END_PART_1---`"
2. **Llamada 2**: Genera secciones 5-9 (Diseño IA, API, Testing, Métricas, Roadmap). Recibe el resultado de la llamada 1 como contexto. Añadir: "Continúa desde la parte 1 (adjunta). Genera secciones 5-9."
3. **Concatenar** ambos resultados, limpiar marcadores, calcular coste combinado.
4. Guardar como markdown en `project_wizard_steps` y `project_documents`.

### Aplicar mismo patrón a Fase 8 (RAGs) si trunca

La Fase 8 genera 45-60 chunks JSON. Si el JSON se trunca (detectado por `parse_error`), añadir lógica de 2 llamadas:
- Llamada 1: Chunks de Funcionalidad + Decisión + Arquitectura
- Llamada 2: Chunks de Proceso + Dato clave + FAQ + config embeddings

### Detalle técnico

```text
project-wizard-step/index.ts
├── Antes del bloque STEP_ACTION_MAP, añadir handler específico para generate_prd
├── 2 llamadas a callGeminiFlash() secuenciales
├── Concatenar result1.text + result2.text
├── Limpiar marcadores ---END_PART_X---
├── Sumar tokens de ambas llamadas para coste
├── Guardar en project_wizard_steps + project_documents
└── Return response con { document, cost, version, parts: 2 }
```

### Archivos a modificar
- `supabase/functions/project-wizard-step/index.ts` — Extraer PRD del handler genérico, implementar 2 llamadas
- Redeploy de la función

### Sin cambios necesarios
- No se necesita nueva tabla, bucket, ni componentes frontend (ya existen)
- No se necesita `docx` ni `file-saver` como dependencia frontend (la generación DOCX ya ocurre server-side en `generate-document`)

