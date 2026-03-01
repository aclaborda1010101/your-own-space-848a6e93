

## Plan: 3 mejoras para Auditoría IA

### 1. Añadir "Auditoría IA" en Visibilidad del Menú

**Archivo**: `src/components/settings/MenuVisibilityCard.tsx`
- Añadir `{ icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia" }` en el grupo "Proyectos", debajo de "Detector Patrones"
- Importar `ShieldCheck` de lucide-react

### 2. Exportación individual de cada fase + Documento Final consolidado

**Archivo**: `src/components/projects/BusinessLeverageTabs.tsx`
- Añadir una 5ª pestaña "Documento Final" que solo se habilita cuando las 4 fases están completas
- Botón "Generar Documento Final" que invoca la edge function `generate-document` (ya existe y genera DOCX profesionales) pasándole el contenido de las 4 fases consolidado

**Archivo**: `src/components/projects/DiagnosticTab.tsx`
- Añadir botón "Exportar MD" que descarga la radiografía como Markdown

**Archivo**: `src/components/projects/RecommendationsTab.tsx`
- Añadir botón "Exportar MD" que descarga el plan por capas como Markdown

**Archivo**: `src/components/projects/QuestionnaireTab.tsx`
- Añadir botón "Exportar MD" que descarga las preguntas + respuestas como Markdown

**Archivo**: `src/hooks/useBusinessLeverage.tsx`
- Añadir función `generateFullDocument` que llama a `generate-document` edge function con todas las fases concatenadas en Markdown, y devuelve el DOCX para descarga

**Nuevo componente**: `src/components/projects/AuditFinalDocTab.tsx`
- Tab que muestra estado de completitud de cada fase (✓/✗)
- Botón "Generar Documento DOCX" que invoca `generate-document`
- Botón "Exportar todo MD" como fallback Markdown

### 3. Compartir entre usuarios

**Archivo**: `src/hooks/useSharing.tsx`
- Añadir `"bl_audit"` como nuevo `ResourceType` (cuando se migre al modelo de auditorías independientes)

**Nota**: Actualmente el `ShareDialog` en `AuditoriaIA.tsx` comparte `business_project`. Cuando se complete la migración a `bl_audits`, se actualizará a compartir el audit directamente. Por ahora, la compartición funciona a nivel de proyecto asociado.

### Detalle técnico — Documento Final DOCX

La edge function `generate-document` ya existe y genera documentos DOCX profesionales con portada, índice, headers/footers. Se reutiliza enviándole el contenido consolidado de las 4 fases como Markdown, con un `stepNumber` especial (ej: 10) para que formatee el documento de auditoría completo.

