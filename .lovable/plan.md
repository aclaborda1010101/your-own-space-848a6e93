

## Plan: Fix cover page — center date, remove white rectangle, fix logo

### Issues from the uploaded PDF
1. **Date not centered** — The date is inside `.cover-meta` which is a left-aligned table (lines 136-138). Need to center it.
2. **White rectangle below date** — The `.cover-meta` table area or the `CONFIDENCIAL` badge background creates a visible white box. The `.cover-meta` table structure itself is the culprit — remove the table wrapper and render date as simple centered text.
3. **Logo missing** — `fetchLogoBase64()` tries `brand/manias-logo.png` and `assets/manias-logo.png` but the file may not exist. Need to re-upload via a one-shot edge function.

### Changes

#### 1. Simplify cover metadata (remove white rectangle + center date)
In `buildCoverHtml()` (line 1015-1026), replace the `.cover-meta` table block with a simple centered date line:

```html
<div class="cover-date">${escHtml(date)}</div>
```

Remove or hide `.cover-badge` (CONFIDENCIAL) — that's likely the white rectangle. Or keep it but ensure no white background leaks. Actually, the badge has `background: var(--alert-red)` so it's red, not white. The white rectangle is the `.cover-meta` table area. Solution: replace the entire meta section with just centered text elements.

**CSS changes:**
- Add `.cover-date` style: centered, white text, `font-size: 10pt`
- Keep `.cover-badge` but remove `.cover-meta` table styling or simplify

**HTML in `buildCoverHtml`:**
```
<div class="cover-doc-type">${title}</div>
<div class="cover-date">${date}</div>
<div class="cover-badge">CONFIDENCIAL</div>
```

Remove the `<div class="cover-meta"><table>...</table></div>` block entirely.

#### 2. Re-upload logo to Supabase Storage
Create temporary `upload-logo` edge function, invoke it, then delete it. Same pattern as before.

#### 3. Redeploy `generate-document`

### Files to edit
- `supabase/functions/generate-document/index.ts` — CSS + `buildCoverHtml()`
- `supabase/config.toml` — temporary function entry
- Temporary `supabase/functions/upload-logo/index.ts`

