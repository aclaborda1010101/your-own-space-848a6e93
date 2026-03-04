

## Fix Plan: PDF Generator — Cover, Date, and Heading Width

### Fix 1 — Cover title letter-spacing
**Line 109-116**: `.cover-title` currently has no explicit `letter-spacing`, but could inherit from parent context. Add `letter-spacing: 0` to `.cover-title` CSS to ensure no inheritance.

### Fix 2 — Date formatting
**Line 1158**: Replace the simple fallback with a format-safe version:
```ts
const dateStr = date?.includes("-") ? date : date?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || new Date().toISOString().split("T")[0];
```

### Fix 3 — H1 width (remove negative margins)
**Lines 236-237**: Change H1 CSS from:
```css
margin: 0 -18mm 20px -22mm;
padding-left: 22mm;
```
to:
```css
margin: 0 0 20px 0;
padding: 14px 22px;
```

### Fix 4 — .section-bar width (same issue)
**Lines 204-205**: Change from:
```css
margin: 0 -18mm 25px -22mm;
padding-left: 22mm;
```
to:
```css
margin: 0 0 25px 0;
padding: 14px 22px;
```

### Summary
4 surgical edits in `supabase/functions/generate-document/index.ts`, then redeploy the edge function.

