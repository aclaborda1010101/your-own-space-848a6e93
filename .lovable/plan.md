
## Diagnóstico del PDF actual

He inspeccionado el `briefing-extraído-v3_2.pdf` que has subido y el código que lo genera. Es un desastre confirmado y la causa es muy concreta:

1. **El botón "Descargar" del Step 2** (`ProjectWizardStep2.tsx` línea 420-429) envía el **JSON crudo completo** (`editedBriefing`) a `generate-document` con `contentType="json"`.
2. **`generate-document/index.ts` no tiene un renderer dedicado para `stepNumber === 2`**. Cae al fallback genérico (líneas 2650-2698) que, para cada array de objetos, vuelca **TODOS los campos como columnas de una tabla markdown**: `id`, `title`, `status`, `certainty`, `blocked_by`, `description`, `source_kind`, `likely_layer`, `inferred_from`, `source_chunks`, `evidence_count` → **11 columnas en A4 vertical** → tablas explotadas, una fila por página, columnas chafadas.
3. **El `_clean_brief_md` ya existe** en el briefing normalizado (en español, 9 secciones limpias) — lo crea `clean-brief-builder.ts` después de normalizar — pero el botón lo **ignora** y manda el JSON bruto en su lugar.
4. **Mezcla EN/ES** porque vuelca `inferred_needs` directamente del briefing pre-normalización (donde aún hay `"Unified AI platform/system"`, `"Workflow optimization and automation"`, etc.) en vez de leer la versión normalizada en castellano.
5. **61 páginas** = volcado bruto de TODA la estructura interna (`legacy_compatibility`, `architecture_signals`, `business_extraction_v2`, `parallel_projects`, `extraction_warnings`...) que jamás debería exportarse a un PDF presentable.

## Lo que vamos a hacer

### 1. Renderer dedicado para Step 2 en `generate-document/index.ts`

Añadir un bloque `else if (stepNumber === 2 && typeof processedContent === "object")` justo antes del fallback genérico (línea 2650), análogo al de step 100/101/102.

Estrategia de contenido: **dos modos**, controlados por `exportMode`:

- **Modo `client` (default — Brief Limpio presentable, ~6-10 páginas):**
  - Si `processedContent._clean_brief_md` existe → renderizarlo directamente con `markdownToHtml()`. Este markdown ya está limpio, en castellano, deduplicado y con 9 secciones canónicas (resumen, activos, problemas, catalizadores, necesidades, oportunidades, riesgos+compliance, preguntas abiertas, componentes candidatos).
  - Si no existe (briefing antiguo sin normalizar) → construirlo on-the-fly llamando a una versión simplificada del builder (importar `buildCleanBrief` desde `./project-wizard-step/clean-brief-builder.ts` o portarlo a un módulo compartido).

- **Modo `internal` (debug/trazabilidad — el "61 páginas" actual):**
  - Mantener el volcado completo, pero con **maquetación corregida** (ver punto 3). Solo accesible explícitamente.

### 2. Cambiar el botón del Step 2 para usar `_clean_brief_md`

En `ProjectWizardStep2.tsx` (línea 419-430): pasar `_clean_brief_md` con `contentType="markdown"` cuando exista, en vez del JSON entero. Mantener el JSON bruto solo si el usuario explícitamente pide "Versión interna completa" (botón secundario discreto).

```tsx
content: editedBriefing._clean_brief_md || editedBriefing,
contentType: editedBriefing._clean_brief_md ? "markdown" : "json",
```

### 3. Maquetación profesional del PDF (CSS de `generate-document`)

Para que NO vuelvan a salir tablas chafadas, modificaremos los estilos en el CSS embebido (líneas 23-380):

- **Tablas con muchas columnas (>5):** detectar en el renderer y emitir el HTML con `<section class="landscape-page">` que forzará `@page { size: A4 landscape; }` mediante CSS `@page :nth(...)` o un wrapper con `page-break-before: always; transform: rotate(...)` (más simple: usar la estrategia nativa Chromium de `@page` con nombres). Implementación recomendada: **named pages**:

  ```css
  @page main { size: A4 portrait; margin: 18mm 16mm; }
  @page wide { size: A4 landscape; margin: 14mm 12mm; }
  body { page: main; }
  .landscape-table-wrapper { page: wide; page-break-before: always; page-break-after: always; }
  ```

- **Tablas que sí quepan en vertical:** limitar a **máximo 4-5 columnas visibles**. En el renderer del Brief Limpio nunca se generan tablas de >3 columnas (las "Necesidades", "Activos", etc. salen como bullets con título+descripción), así que esto se aplica solo al modo internal.

- **Padding de celdas, line-height, anti-overflow:**
  ```css
  table { table-layout: fixed; word-wrap: break-word; }
  td, th { padding: 6pt 8pt; vertical-align: top; font-size: 9pt; line-height: 1.35; }
  td { word-break: break-word; }
  ```

- **Respiración general (cendal/márgenes):** subir margen de página de ~14mm a **18mm verticales / 16mm horizontales** para evitar que el contenido toque el footer "Pág X de Y".

- **Footer y header:** ya están en su sitio, pero ahora respiran.

### 4. Garantía de castellano

- En modo `client`, el renderer **solo** lee de `_clean_brief_md` o reconstruye desde `_normalized_briefing` (siempre post-normalización ES).
- Antes de pasar al `markdownToHtml`, aplicar `translateForClient()` (que ya existe en el archivo) como red de seguridad por si algún campo se cuela en EN.
- Si el briefing aún no se ha normalizado, el botón de descargar mostrará un **toast "Normaliza el brief antes de exportar"** y deshabilitará el modo client (forzando al usuario a pulsar primero "✨ Limpiar y normalizar").

### 5. Resultado esperado

| Antes | Después |
|---|---|
| 61 páginas, tablas de 11 columnas chafadas | ~6-10 páginas, layout limpio |
| Mezcla ES/EN | 100% castellano |
| Vuelca `source_chunks`, `evidence_count`, `inferred_from`, `_*_from` | Solo contenido de negocio |
| Una fila por página | Listas con título + descripción legibles |
| `legacy_compatibility`, `extraction_warnings`, `business_extraction_v2` visibles | Ocultos en cliente, disponibles en modo internal |
| Todo vertical aunque no quepa | Páginas anchas (landscape) solo cuando una tabla lo necesita en modo internal |

## Archivos a modificar

1. **`supabase/functions/generate-document/index.ts`**
   - Añadir bloque `else if (stepNumber === 2 && ...)` antes del fallback genérico (~línea 2650).
   - Modificar el CSS embebido (~líneas 340-380) para `@page` named pages, `table-layout: fixed`, padding aumentado.
   - Si hace falta importar `buildCleanBrief`, añadir el import al top del archivo.

2. **`src/components/projects/wizard/ProjectWizardStep2.tsx`**
   - Línea 419-430: pasar `_clean_brief_md` (markdown) por defecto.
   - Añadir validación: si no hay `_clean_brief_md`, mostrar toast pidiendo normalizar primero (o auto-trigger del botón "Limpiar y normalizar" antes de descargar).
   - Opcional: añadir botón secundario discreto "Versión interna (debug)" que mande el JSON crudo en modo `internal`.

3. **`supabase/functions/project-wizard-step/clean-brief-builder.ts`** (revisar)
   - Verificar que el markdown que produce ya cubre las 9 secciones bien y está 100% en español. Ajustar wording si hace falta.

## Lo que NO vamos a tocar

- El pipeline de extracción/normalización (ya funciona, el brief actual está bien generado, solo está mal renderizado a PDF).
- Otros steps (3, 4, 5, 6, 100, 101, 102) — sus renderers dedicados ya funcionan.
- El JSON guardado en BD — sigue siendo la fuente de verdad bruta; solo cambia cómo se presenta al exportar.
