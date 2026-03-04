

## Plan: Replace generate-document Edge Function

### What
Replace the entire `supabase/functions/generate-document/index.ts` (896 lines) with the user-provided version (~1,290 lines). This is a complete rewrite of the HTML→PDF generator with:

- New CSS design system using CSS variables and Google Fonts (Raleway + Inter)
- Teal accent color (#0D9488) replacing the previous green (#7ED957)
- KPI score detection with progress bars
- Opportunity card components
- Improved cover page, TOC, signature, and CTA page
- Same html2pdf.app API integration and Supabase storage pipeline

### Steps

1. **Replace file** — Overwrite `supabase/functions/generate-document/index.ts` with the pasted content (verbatim, no modifications)
2. **Deploy** — Redeploy the `generate-document` edge function

### No other changes needed
- `HTML2PDF_API_KEY` secret already exists
- Frontend components already use `.pdf` extension and correct invocation pattern
- Storage bucket `project-documents` already exists

