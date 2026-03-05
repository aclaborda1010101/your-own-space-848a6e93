

## Plan: Fix Chrome blocking PDF downloads

### Problem
When clicking the PDF button in the wizard, Chrome blocks the page. The signed URL from Supabase Storage is cross-origin, so the `<a download>` attribute is ignored by Chrome -- it treats it as a navigation to an external URL, which gets blocked.

### Solution
Change the download approach in `ProjectDocumentDownload.tsx` to **fetch the PDF as a blob first**, then create a local blob URL for download. This avoids cross-origin issues entirely.

Also fix the same pattern in `useDocxExport.ts` and `AuditFinalDocTab.tsx` which have the additional problem of `target="_blank"`.

### Changes

**1. `src/components/projects/wizard/ProjectDocumentDownload.tsx`**
Replace the direct anchor approach with:
```typescript
const response = await fetch(data.url);
const blob = await response.blob();
const blobUrl = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = blobUrl;
a.download = data.fileName || `documento-fase-${stepNumber}.pdf`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(blobUrl);
```

**2. `src/hooks/useDocxExport.ts`**
Same blob fetch pattern, remove `target="_blank"`.

**3. `src/components/projects/AuditFinalDocTab.tsx`**
Same blob fetch pattern, remove `target="_blank"`.

