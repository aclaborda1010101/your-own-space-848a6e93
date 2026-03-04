
Objetivo: corregir de una vez los 4 bugs de portada del PDF, eliminar todas las acciones “Exportar MD” del flujo de Auditoría/Documentos, y dejar la exportación PDF robusta (sin pestaña/pantalla blanca).

1) Correcciones de portada en `supabase/functions/generate-document/index.ts`
- Bug 1 (espaciado): cambiar `.cover-doc-type` de `letter-spacing: 4px` a `1px`.
- Bug 2 (marco blanco): eliminar el hack de márgenes negativos de `.cover-page` y aplicar:
  - `@page :first { margin: 0; }`
  - mantener `@page` normal para páginas 2+.
- Bug 3 (desborde a página 2):
  - `.cover-body` padding `60px -> 30px`
  - `.cover-subtitle` margin-bottom `50px -> 25px`
  - `.cover-badge` margin-top `35px -> 15px`
  - `.cover-page`: `height: 100vh` (no `min-height`), `overflow: hidden`, y layout para que la barra inferior no salte de página.
- Bug 4 (logo):
  - rehacer bloque superior como `.cover-top-bar` con `<img ... height:40px>`.
  - robustecer `fetchLogoBase64()` para intentar rutas en orden:
    1) `brand/manias-logo.png`
    2) `assets/manias-logo.png`
    3) fallback de texto “ManIAS Lab.” si falla lectura.
  - mantener logo encima del título.

2) Eliminación de todos los “Exportar MD” (solo PDF)
- Quitar botones/handlers/imports MD en:
  - `src/components/projects/QuestionnaireTab.tsx`
  - `src/components/projects/DiagnosticTab.tsx`
  - `src/components/projects/RecommendationsTab.tsx`
  - `src/components/projects/RoadmapTab.tsx`
  - `src/components/projects/AuditFinalDocTab.tsx`
  - `src/components/projects/wizard/ProjectWizardStep3.tsx`
- Renombrar labels “Exportar DOCX” a “Exportar PDF” donde corresponda (la salida real ya es PDF).

3) Evitar pantalla/pestaña blanca al exportar PDF
- Reemplazar `window.open(data.url, "_blank")` por descarga controlada (anchor + `download`, o fetch blob + object URL) en:
  - `src/hooks/useDocxExport.ts`
  - `src/components/projects/AuditFinalDocTab.tsx`
- Mantener estado loading, deshabilitar botones durante generación y mensajes de error claros.

4) Verificación funcional (end-to-end) tras cambios
- Probar cada botón PDF en `/auditoria-ia`:
  - Cuestionario, Radiografía, Plan por Capas, Roadmap, Documento Final.
- Confirmar:
  - no se abre pestaña en blanco,
  - descarga/abre PDF correctamente,
  - portada 100% color (sin marco),
  - sin desborde a página 2,
  - logo visible encima del título,
  - “DOCUMENTO FINAL DE AUDITORÍA” sin espaciado excesivo.
- Probar también botones PDF/ZIP del panel de documentos del wizard para asegurar que no se rompe el flujo de descarga.
