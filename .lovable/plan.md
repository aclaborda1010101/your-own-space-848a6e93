

## Plan: Fix PDF cover page — logo, title, date format, full-bleed background

### Issues identified
1. **Logo not appearing** — `fetchLogoBase64()` downloads from `project-documents/assets/manias-logo.png`. If the file doesn't exist there, it returns empty string and falls back to text. Need to verify and re-upload.
2. **Title not uppercase / too large** — `.cover-title` is 34pt. Should be uppercase and smaller (~18pt).
3. **Logo must be ABOVE the title** — Currently logo is in `.cover-header`, title in `.cover-body`. Order is correct but need to ensure logo renders.
4. **Date format** — Currently `YYYY-MM-DD`. Must be `DD/MM/YYYY`.
5. **White border around cover** — The `@page` margin (22mm 18mm 25mm 22mm) creates white edges. The negative margin hack (`margin: -22mm -18mm 0 -22mm`) doesn't fully cover bottom. Need to also cover bottom margin.

### Changes in `supabase/functions/generate-document/index.ts`

#### 1. Cover CSS — full bleed, no white border
Line 67: Change `.cover-page` margin to `-22mm -18mm -25mm -22mm` (add bottom negative margin) and set `min-height: calc(100vh + 47mm)` to fill the entire page including margins.

#### 2. Title styling — uppercase, smaller font
Line 115-124: Change `.cover-title` to `font-size: 18pt`, add `text-transform: uppercase`.

#### 3. Date format — DD/MM/YYYY
Line 1188: After computing `dateStr` in `YYYY-MM-DD` format, convert to `DD/MM/YYYY`:
```ts
const [y, m, d] = dateStr.split("-");
const displayDate = `${d}/${m}/${y}`;
```
Use `displayDate` in `buildCoverHtml` and `buildFullHtml`.

#### 4. Logo — re-upload via one-shot edge function
Create and invoke a temporary `upload-logo` function again to ensure `assets/manias-logo.png` exists in storage. Then delete the function.

#### 5. buildCoverHtml — pass display date
Line 1019: Title is already `projectName` which contains the audit name. Ensure `text-transform: uppercase` handles the casing via CSS.

### Summary
5 surgical changes + 1 logo re-upload to storage, then redeploy `generate-document`.

