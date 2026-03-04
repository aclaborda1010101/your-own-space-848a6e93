

## Plan: Fix TOC title and redesign cover with logo

### Changes in `supabase/functions/generate-document/index.ts`

#### 1. Change "Contenido" to "Índice" in the TOC page
Line 1051: Replace `Contenido` with `Índice` in the section bar.

#### 2. Redesign cover page to match the DOCX template
The current cover has a top bar with text-only "ManIAS Lab." logo. The template shows: logo image centered at top, then document title below.

**New cover layout:**
- Remove the dark top bar with text logo
- Center the ManIAS logo image (from `src/assets/manias-logo.png`) at the top of the cover
- Place the document title below the logo
- Keep the meta table (client, date, version) and bottom bar

**Logo strategy:** The edge function runs server-side and cannot access bundled assets. Two options:
- **Option A**: Upload `manias-logo.png` to the `project-documents` Supabase storage bucket (e.g., `assets/manias-logo.png`) as a public file, then reference its public URL in the HTML
- **Option B**: Embed the logo as a base64 data URI directly in the HTML — no external dependency, guaranteed to render in the PDF

I will use **Option B** (base64 embed) since it is self-contained and avoids CORS/availability issues with html2pdf.app fetching external images.

**Steps:**
1. Read `src/assets/manias-logo.png`, convert to base64, embed as a constant in the edge function
2. Rewrite `buildCoverHtml()`: logo image centered → title below → divider → subtitle → meta → badge
3. Update `.cover-page` CSS: remove top bar styles, add centered logo styling
4. Change TOC title from "Contenido" to "Índice"
5. Redeploy the edge function

