

## Plan: Fix 4 remaining PDF cover/styling issues

### Analysis

- **Logo**: Logs confirm the file loads correctly (142,206 bytes from `assets/manias-logo.png`). The base64 data URI is generated. The problem is likely that **html2pdf.app** doesn't reliably render large inline base64 images. The fix is to use a **public signed URL** instead of a data URI — download the file, create a signed URL, and use that as the `src`.
- **Font**: Currently imports `Inter`. Need to switch to `Montserrat`.
- **H5**: Missing `border-bottom` teal line.
- **Content padding**: No CSS for `.content-body` — content is flush to edges.

### Changes in `supabase/functions/generate-document/index.ts`

#### 1. Logo — Use signed URL instead of base64
Replace `fetchLogoBase64()` with `fetchLogoUrl()` that creates a signed URL (valid 1 hour) from Supabase Storage. This avoids the base64 rendering issue in html2pdf.app:

```ts
async function fetchLogoUrl(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const paths = ["brand/manias-logo.png", "assets/manias-logo.png"];
  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      console.log(`Logo signed URL from ${path}`);
      return data.signedUrl;
    }
  }
  return "";
}
```

Update `buildCoverHtml` to use `<img src="${signedUrl}"` instead of base64.

#### 2. Font — Inter → Montserrat
Line 23: Change the Google Fonts import from `Inter` to `Montserrat`:
```css
@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Montserrat:wght@400;500;600;700&display=swap');
```

Update all `font-family: 'Inter'` references to `font-family: 'Montserrat'`.

#### 3. H5 — Add teal border-bottom
Lines 247-253: Add `border-bottom: 2px solid var(--accent); padding-bottom: 5px;` to the existing `h5` rule.

#### 4. Content padding
Add CSS rule for `.content-body`:
```css
.content-body {
  padding: 0 5px;
}
```

#### 5. Redeploy
Deploy the updated `generate-document` function.

