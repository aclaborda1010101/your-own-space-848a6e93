# Brief Limpio v4 — corrección global del pipeline Step 2 + exportación PDF

Las correcciones son **globales** (afectan a cualquier proyecto, no solo AFFLUX). El usuario aporta AFFLUX como caso de prueba.

## Diagnóstico verificado en BD y código

He inspeccionado `project_wizard_steps` para el proyecto AFFLUX (`6ef807d1-…`, step_number = 2, version 3, status = review):

| Campo | Estado actual | Esperado |
|---|---|---|
| `_clean_brief_md` | **NO existe** | markdown limpio 3-5 páginas |
| `_normalization_log` | **NO existe** | log con cambios aplicados |
| `_chunked_extraction_meta` | existe | existe |
| `client_naming_check.client_company_name` | `"Alejandro Gordo"` (mal) | nombre real de la empresa |
| `client_naming_check.proposed_product_name` | `null` | nombre del producto |

**Conclusión:** las acciones `retry_failed_chunks` y `normalize_brief` añadidas en la iteración anterior **nunca se han ejecutado** sobre este proyecto. La UI tiene los botones, pero o el usuario no los pulsó, o se ejecutaron contra una versión y se persistieron sobre otra que luego fue sobrescrita por una re-extracción.

Y en `supabase/functions/generate-document/index.ts`:
- **No existe** ninguna rama `if (stepNumber === 2)`.
- Step 2 cae al fallback genérico (línea 2650+) que serializa el JSON crudo a tablas markdown → de ahí las **61 páginas, mezcla EN/ES, "retail", FAILED CHUNKS visibles, naming incorrecto**.
- Aunque añadiéramos `_clean_brief_md`, el generador actual **no lo lee** porque recibe el `output_data` completo y lo mete entero en el fallback.

## Plan global — 4 ejes

### 1. Generador PDF: priorizar `_clean_brief_md` para Step 2 (global)

`supabase/functions/generate-document/index.ts` — añadir rama dedicada antes del fallback genérico (~línea 2649):

```ts
// ── Step 2: Brief Limpio renderer (global, todos los proyectos) ──
if (stepNumber === 2 && typeof processedContent === "object" && processedContent !== null) {
  const cleanMd = processedContent._clean_brief_md;
  if (typeof cleanMd === "string" && cleanMd.trim().length > 200) {
    // Render directo del Brief Limpio normalizado
    htmlContent = markdownToHtml(cleanMd);
  } else {
    // Fallback degradado: aviso + resumen mínimo (NO volcar el JSON crudo)
    htmlContent = markdownToHtml(buildMinimalBriefFallback(processedContent));
  }
}
```

Donde `buildMinimalBriefFallback` extrae solo los 4-5 campos presentables (resumen, naming, top necesidades) y añade un banner: *"Brief no normalizado todavía. Pulsa 'Limpiar y normalizar' antes de exportar."* Así **nunca** se exporta JSON crudo de 61 páginas.

### 2. Auto-ejecución del pipeline limpio en `useProjectWizard`

Hoy `retry_failed_chunks` y `normalize_brief` solo se disparan si el usuario pulsa los botones. Cambio global:

- Tras cualquier `extract` / `force_full_extract` / `chunked_re_extract` exitoso en Step 2, encadenar automáticamente:
  1. `retry_failed_chunks` si `_chunked_extraction_meta.failed_chunks_count > 0`
  2. `normalize_brief` siempre (genera `_clean_brief_md`, corrige naming, dedup, EN→ES, sectorial, compliance)
- Persistir el resultado final como **una sola versión nueva** (no dos), para evitar que el usuario apruebe una versión "sucia".
- Mostrar un toast informativo: *"Brief extraído, normalizado y limpio generado"*.

Los botones manuales se mantienen como fallback para reejecutar cualquier paso.

### 3. Endurecer `normalize_brief` para que el naming siempre quede bien

En `brief-normalizer.ts` → `applyNamingSplit`:

- Si `client_company_name` es claramente un **nombre de persona** (2 palabras tipo "Nombre Apellido", sin S.L./S.A./Inc/Corp), promoverlo a `founder_or_decision_maker` y dejar `client_company_name` con el `companyName` del contexto (que viene de `business_projects.company`) o marcar `[POR CONFIRMAR]`.
- Si `proposed_product_name` está vacío y existe `business_model_summary.title` con un nombre propio único, proponerlo.
- Registrar todos los cambios en `_normalization_log.changes` con `type: "naming_split"`.

Esto ya estaba parcialmente, pero no se está activando porque `normalize_brief` nunca corrió. Verifico además que el heurístico cubra el caso "Alejandro Gordo".

### 4. Botón "Descargar PDF" en Step 2: bloqueo + auto-trigger

En `ProjectWizardStep2.tsx` y/o `ProjectDocumentDownload`:

- Si `briefing._clean_brief_md` no existe, **deshabilitar** el botón de descarga y mostrar tooltip: *"Genera primero el Brief Limpio (Limpiar y normalizar)"*.
- Alternativa más amable: el botón ofrece *"Generar Brief Limpio y descargar"* que dispara `normalize_brief` y luego descarga.
- El payload enviado a `generate-document` para Step 2 sigue siendo el `output_data` completo (el generador ya sabe leer `_clean_brief_md`); **no enviamos el markdown desde el cliente** para que el PDF siempre refleje la última versión persistida.

## Maquetación PDF (afecta global, ya parcialmente cubierto)

El CSS actual ya usa Montserrat/Raleway, A4, márgenes 22/18/25/22mm, headers/footers ManIAS. Para el Brief Limpio (~3-5 páginas) **no hace falta** landscape ni tablas anchas — el `_clean_brief_md` está pensado como prosa con bullets y subtítulos H2 simples. Por tanto:

- **No** introduzco named pages landscape para Step 2 (sería matar moscas a cañonazos).
- Mantengo CSS actual.
- Si en el futuro otro step necesitase landscape, lo añadimos aislado con `@page wide`.

## Criterios de aceptación

Tras este cambio, en **cualquier** proyecto:

- [ ] Después de extraer Step 2, el sistema deja `_clean_brief_md` poblado automáticamente.
- [ ] `_normalization_log.changes` muestra cambios de naming, dedup, idioma, sectorial.
- [ ] El PDF de Step 2 tiene **3-7 páginas** (no 61), sin "FAILED CHUNKS", sin "retail", sin mezcla EN/ES, con naming correcto.
- [ ] Si el usuario intenta descargar sin `_clean_brief_md`, el sistema o lo bloquea o lo genera al vuelo.
- [ ] AFFLUX, al volver a extraer (o al pulsar "Limpiar y normalizar" sobre v3 actual), produce un PDF limpio con `client_company_name = "AFFLUX"` (o la empresa real del proyecto), `founder = "Alejandro Gordo"`.

## Archivos a modificar

1. `supabase/functions/generate-document/index.ts` — rama Step 2 + helper `buildMinimalBriefFallback`.
2. `supabase/functions/project-wizard-step/brief-normalizer.ts` — endurecer `applyNamingSplit`.
3. `src/hooks/useProjectWizard.ts` — encadenar auto-normalize tras extract.
4. `src/components/projects/wizard/ProjectWizardStep2.tsx` — bloqueo/auto-trigger del botón download.
5. `src/main.tsx` — bump cache-bust.

## Lo que **no** hago

- No toco F2/F3/F4/F5 (fuera de alcance).
- No introduzco landscape PDF (innecesario para markdown limpio).
- No re-extraigo automáticamente proyectos viejos: el usuario los normaliza con el botón ya existente o re-extrayendo.
