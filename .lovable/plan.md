

# PDF Upload Error Diagnosis

## What Happened

When you uploaded "Marketplace Farma V3 _ MGA.pdf", the PDF.js library tried to load its worker from CDN:

```
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.worker.min.js
```

This failed because **pdfjs-dist v5.x** changed how workers are loaded -- it uses dynamic `import()` instead of classic script loading. The CDN URL doesn't support ES module dynamic imports from a different origin, causing:

> "Failed to fetch dynamically imported module"

The toast showed: *"Setting up fake worker failed"*

## Root Cause

In `src/lib/document-text-extract.ts`, the worker is configured as:
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

But pdfjs-dist **v5.4.624** requires either:
1. A local worker file bundled by Vite, or
2. The `.mjs` version served with proper CORS/module headers

## Fix

Change `document-text-extract.ts` to use the **legacy build** approach that works without a separate worker -- disable the worker entirely and run PDF parsing on the main thread:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = "";
```

And update `getDocument` to use `disableAutoFetch` + `useWorkerFetch: false` (already partially done). Alternatively, use the unpkg CDN with the `.mjs` extension that supports ES modules, or copy the worker to `public/` and reference it locally.

### Recommended approach

Set `workerSrc` to empty string and rely on the fake worker (main-thread parsing). This is the most reliable for Vite/preview environments. The "fake worker" warning in console is harmless -- it just means PDF parsing runs on the main thread instead of a web worker.

### File: `src/lib/document-text-extract.ts`

- Remove CDN workerSrc line
- Set `pdfjsLib.GlobalWorkerOptions.workerSrc = ""`
- Keep existing `useWorkerFetch: false` and `isEvalSupported: false` options

This is a one-line change that will fix PDF uploads immediately.

