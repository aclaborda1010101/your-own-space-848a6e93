

## Diagnóstico: Campos internos contaminan el PDF del briefing

### Problema
El generador de PDF (`generate-document/index.ts`, líneas 1186-1208) itera sobre **todas** las claves del objeto JSON del briefing. Los campos internos añadidos por el filtro de transcripción (`_was_filtered`, `_filtered_content`, `_original_content`) se renderizan como contenido del documento, incluyendo la transcripción completa filtrada — que puede ser de miles de caracteres.

Solo se excluyen `parse_error` y `raw_text` (línea 1188), pero no los nuevos campos `_was_filtered`, `_filtered_content`, ni `_original_content`.

### Solución

**1. Edge Function `generate-document/index.ts` (línea 1188)**

Ampliar la lista de claves excluidas del renderizado JSON genérico para incluir todos los campos internos/de metadatos:

```typescript
if (key.startsWith("_") || key === "parse_error" || key === "raw_text") continue;
```

Usar `key.startsWith("_")` como convención: cualquier clave que empiece con `_` se considera interna y no se incluye en el PDF.

**2. Renderizado específico para Fase 2 (Briefing)**

Opcionalmente, mejorar el renderizado del briefing para que las secciones principales (resumen ejecutivo, objetivos, stakeholders, alertas, restricciones, datos faltantes) tengan un formato más profesional con badges de prioridad y tablas. Esto ya estaba descrito en la memory `formato-documentos-json-v1` pero la exclusión de campos `_*` es el fix crítico.

### Impacto
- Fix rápido: 1 línea cambiada en la edge function
- Redespliegue de `generate-document`

