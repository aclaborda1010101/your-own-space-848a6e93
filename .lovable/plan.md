

# Plan: Fix "GlobalWorkerOptions.workerSrc" error in PDF extraction

## Root Cause

There are **two separate files** that use `pdfjs-dist` for PDF extraction:

1. **`src/lib/document-text-extract.ts`** — imports the **legacy** build (`pdfjs-dist/legacy/build/pdf.mjs`) and sets `workerSrc = ""`. This one works.
2. **`src/lib/whatsapp-file-extract.ts`** (line 2) — imports the **standard** build (`pdfjs-dist`) and does **NOT** set `workerSrc`. This triggers the error.

When uploading a PDF from the wizard step 1 page, `document-text-extract.ts` is used (which works). But if any code path triggers `whatsapp-file-extract.ts`'s `extractTextFromPDF`, the error fires because the standard build requires a web worker.

## Fix

**`src/lib/whatsapp-file-extract.ts`** — 2 changes:

1. Change line 2: `import * as pdfjsLib from 'pdfjs-dist'` → `import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'`
2. Add after imports: `pdfjsLib.GlobalWorkerOptions.workerSrc = "";`
3. Update `extractTextFromPDF` (line 446) to pass the same options as `document-text-extract.ts`: `useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true`

This aligns both files to use the same legacy/fake-worker approach that already works in `document-text-extract.ts`.

## Files to modify

| File | Change |
|---|---|
| `src/lib/whatsapp-file-extract.ts` | Switch to legacy pdfjs import, set workerSrc, add getDocument options |

