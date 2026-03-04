

## Plan: Refactoring DOCX generator to match ManIAS corporate template

### Overview

Restructure `supabase/functions/generate-document/index.ts` to use a two-section layout, full-width H1 shading bars, gray bordered tables, and native TOC styles matching the uploaded template.

### Changes in `supabase/functions/generate-document/index.ts`

**1. Two-section document layout (buildDocx function, lines 926-1021)**

Replace the single `sections` array with two sections:

- **Section 0 (Cover)**: `SectionType.NEXT_PAGE`, margins `top: 454` (8mm), `bottom: 340` (6mm), `left: 624` (11mm), `right: 397` (7mm). No headers/footers. Children: cover page elements only.
- **Section 1 (Content)**: Margins `top: 737` (13mm), `bottom: 510` (9mm), `left: 510` (9mm), `right: 397` (7mm). Headers and footers. Children: executive summary, TOC, content, signature page.

Import `SectionType` from docx (add to import line 3).

**2. H1 headings as full-width shading bars (markdownToParagraphs, lines 771-784)**

Replace the current H1 rendering (border-bottom underline, teal text) with a paragraph that has:
- `shading: { type: ShadingType.CLEAR, fill: "0A3039" }`
- Text: white (`FFFFFF`), Arial, 40 half-points (20pt), bold
- Remove the `border.bottom` line
- Keep `PageBreak` before each H1 (except first)

**3. TOC with native Word styles (createManualTOC, lines 402-448)**

Replace manual paragraphs with paragraphs using native TOC styles:
- H1 entries: `style: "toc 1"` with a right-aligned tab stop at position ~9000 for page numbers
- H2 entries: `style: "toc 2"` with indented left and same right tab stop

Define `toc 1` and `toc 2` in the document `styles.paragraphStyles` array inside `buildDocx`. These styles should use Arial font, appropriate sizes, and tab stops.

**4. Tables with gray borders, no zebra, no colored headers (parseMarkdownTable + parseAsciiTable, lines 451-562)**

Update `BRAND.border` to `"9A9A9A"` or create a new constant `TABLE_BORDER = "9A9A9A"`.

Modify `parseMarkdownTable` and `parseAsciiTable`:
- All borders: `BorderStyle.SINGLE`, color `9A9A9A`, all 4 sides + insideHorizontal + insideVertical
- Header row: bold text, **no** colored background (remove `shading` with `BRAND.primary`), text color stays dark
- Data rows: remove zebra striping logic (remove `isZebra` conditional shading)
- Keep severity coloring for specific cell values (CRÍTICO, ALTO, etc.)

Update `proBorders` helper or replace it with a new `grayBorders` helper that applies `#9A9A9A` single borders on all sides.

**5. Upload template to Storage (not implemented in code)**

The user asked to upload the DOCX template to Supabase Storage and use it as a base. However, the `docx` npm library creates documents programmatically — it cannot open/modify existing `.docx` files (that requires a different approach like `docx-templates` or server-side manipulation). The current approach of building the document from scratch with the correct styles, margins, and section structure will replicate the template faithfully. The template file serves as a visual reference, not a runtime dependency.

### Summary of constant changes

- `BRAND.border`: `"E5E7EB"` → `"9A9A9A"` (or new `TABLE_BORDER` constant)
- Import: add `SectionType` to line 3
- Cover section: reduced margins, no header/footer
- Content section: normal margins, header/footer
- H1: shading bar instead of underline
- Tables: uniform gray borders, no zebra, no colored headers
- TOC: native `toc 1`/`toc 2` paragraph styles

