

## Plan: Migrate DOCX Generator to HTML→PDF via html2pdf.app

### Why

The current `docx` npm library generates XML that renders inconsistently across Word, Google Docs, and LibreOffice. HTML→PDF produces pixel-perfect output every time.

### Architecture

```text
CURRENT:  Markdown → parse → docx library → .docx → upload to Storage
NEW:      Markdown → parse → HTML + CSS inline → html2pdf.app API → .pdf → upload to Storage
```

### Prerequisites

1. **API Key**: Need `HTML2PDF_API_KEY` secret added to Supabase. The user must sign up at https://html2pdf.app and get an API key.

### Changes to `supabase/functions/generate-document/index.ts`

**Complete rewrite** of the edge function. The new flow:

1. **Remove** all `docx` library imports (`Document`, `Packer`, `Paragraph`, `TextRun`, etc.)
2. **Keep** the same HTTP interface (same request/response JSON shape, same `serve()` handler)
3. **Keep** `sanitizeMarkdown()`, `toTitleCase()`, and the markdown parsing logic but output HTML strings instead of docx objects
4. **New function `markdownToHtml()`**: Converts markdown to styled HTML using the ManIAS corporate CSS (inline styles). Replaces `markdownToParagraphs()`.
5. **New function `buildHtmlDocument()`**: Assembles the full HTML page with:
   - `@page` CSS for A4 margins
   - Cover page (teal bands, metadata table, CONFIDENCIAL badge) using CSS
   - TOC with dot leaders via CSS (`content: leader(".")`)
   - H1 as full-width dark bars (`background: #0A3039; color: white; padding: 12px 16px; font-size: 20pt`)
   - Tables with `border: 1px solid #9A9A9A` and bold headers
   - Callout boxes as styled divs with left border
   - Signature page
   - Google Fonts embed (Raleway + Inter) or fallback to Arial/Calibri system fonts
6. **New function `convertToPdf()`**: Sends the HTML string to `https://api.html2pdf.app/v1/generate` with:
   ```typescript
   const response = await fetch("https://api.html2pdf.app/v1/generate", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       html: fullHtmlString,
       apiKey: Deno.env.get("HTML2PDF_API_KEY"),
       format: "A4",
       marginTop: 0,    // margins handled in CSS
       marginBottom: 0,
       marginLeft: 0,
       marginRight: 0,
       displayHeaderFooter: true,
       headerTemplate: "<div style='font-size:8pt;width:100%;text-align:right;padding-right:18mm;color:#6B7280;'>CONFIDENCIAL</div>",
       footerTemplate: "<div style='font-size:8pt;width:100%;padding:0 18mm;display:flex;justify-content:space-between;color:#6B7280;'><span>ManIAS Lab.</span><span>Pag <span class='pageNumber'></span> de <span class='totalPages'></span></span></div>",
     }),
   });
   ```
7. **Upload**: Change file extension from `.docx` to `.pdf`, content type to `application/pdf`. Update `file_format` in DB to `"pdf"`.

### Changes to client-side components

- `ProjectDocumentDownload.tsx`: Change default filename extension from `.docx` to `.pdf`, button label from "DOCX" to "PDF"
- `ProjectDocumentsPanel.tsx`: Update ZIP filename and individual doc extensions
- `AuditFinalDocTab.tsx`: Update button label and toast messages
- `useDocxExport.ts`: Rename to `usePdfExport.ts` or keep name but update toast messages

### HTML structure (key sections)

```text
<html>
  <head><style>/* All CSS inline */</style></head>
  <body>
    <div class="cover-page">        <!-- page-break-after: always -->
      <div class="brand-bar">ManIAS Lab.</div>
      <h1 class="cover-title">DOCUMENTO DE ALCANCE</h1>
      <table class="metadata">...</table>
      <div class="confidential-badge">CONFIDENCIAL</div>
      <div class="brand-bar-bottom">ManIAS Lab. | Consultora Tecnológica</div>
    </div>
    <div class="toc-page">          <!-- page-break-after: always -->
      <h1 class="section-bar">Índice de Contenidos</h1>
      <div class="toc-entry toc-1">...</div>
    </div>
    <div class="content">
      <!-- H1 → <div class="h1-bar">text</div> -->
      <!-- H2 → <h2>text</h2> -->
      <!-- tables → <table class="data-table"> -->
      <!-- callouts → <div class="callout callout-pendiente"> -->
    </div>
    <div class="signature-page">...</div>
  </body>
</html>
```

### What stays the same

- Same edge function name (`generate-document`)
- Same request/response contract (projectId, stepNumber, content, contentType, etc.)
- Same Supabase Storage bucket (`project-documents`)
- Same `project_documents` DB table
- Markdown parsing logic (headings, bullets, tables, callouts) — just outputs HTML instead of docx objects

### Implementation order

1. Add `HTML2PDF_API_KEY` secret
2. Rewrite `generate-document/index.ts` with HTML builder + API call
3. Update client components (labels, extensions)
4. Deploy and test

