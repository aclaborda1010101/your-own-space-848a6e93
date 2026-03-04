

## Plan: Logo SVG inline + línea verde lima en footer

### Changes in `supabase/functions/generate-document/index.ts`

#### 1. Replace `fetchLogoUrl()` with inline SVG
Remove `fetchLogoUrl()` function entirely. In `buildCoverHtml()`, replace the `<img>` tag with an inline SVG:

```html
<svg height="40" viewBox="0 0 220 40" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="30" font-family="Raleway,sans-serif" font-size="28" font-weight="300" fill="white">
    Man<tspan font-weight="700" fill="#BEFF00">IAS</tspan> Lab<tspan fill="#BEFF00">.</tspan>
  </text>
</svg>
```

#### 2. Footer lime line (content pages only)
Update `footerTemplate` in the html2pdf.app API call to add `border-top: 1.5px solid #BEFF00` above the footer text.

#### 3. Redeploy
Deploy updated `generate-document` function.

### Files
- `supabase/functions/generate-document/index.ts`

