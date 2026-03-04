

## Plan: Visual PDF Improvements (with table header correction)

All changes in **`supabase/functions/generate-document/index.ts`**, then redeploy.

### Changes to `getStyles()`:

1. **Google Fonts** — Add `@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@600;700;800&family=Inter:wght@400;500;600&display=swap')` at the top of the style block. Update `font-family` references:
   - Cover title, brand bars, H1 bars, headings → `Raleway, Arial, sans-serif`
   - Body text → `Inter, Calibri, sans-serif`

2. **Cover page breathing** — `.cover-title` font-size `28pt → 36pt`, margin-bottom `8px → 16px`. `.cover-subtitle` margin-bottom `40px → 60px`. Replace `.cover-line` with a `.cover-divider`: `width: 100px; height: 4px; background: #0D9488; margin: 0 auto 20px;`. `.brand-bar` padding `18px → 28px`.

3. **Table headers — keep dark blue** (per user request, NOT gray). Add explicit styling:
   - `.data-table th { background: #0A3039; color: #FFFFFF; }` — maintaining the ManIAS brand presence.

4. **Callout refinements** — Add `border-radius: 4px;` to `.callout`. Add Unicode icon prefixes in `markdownToHtml()`: `⚠` for PENDIENTE, `🔴` for ALERTA, `✅` for CONFIRMADO.

5. **H1 bar accent** — Add `border-bottom: 3px solid #0D9488;` to `.h1-bar` for a teal accent line. Increase padding `10px 16px → 12px 16px`.

6. **KPI boxes** — `.kpi-value` font-size `24pt → 28pt`. Add `.kpi-bar` and `.kpi-fill` CSS for progress bars (teal `#0D9488` fill on light gray background).

7. **Signature page** — Add subtle `border-top: 2px solid #0A3039;` to signature blocks, increase spacing.

### Changes to `buildCoverHtml()`:
- Replace `<hr class="cover-line">` with `<div class="cover-divider"></div>`

### Changes to `markdownToHtml()`:
- Add callout icon prefixes (Unicode) when generating callout HTML
- Add KPI score pattern detection (`**Name**: XX/100`) → render as `.kpi-box` with `.kpi-bar`/`.kpi-fill`

### Changes to `buildHtmlDocument()`:
- Add Google Fonts `@import` in the `<style>` block (inside the CSS, not as a separate `<link>`)

### Deploy
- Redeploy edge function after changes

