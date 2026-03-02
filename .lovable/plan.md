

## Plan: Fix raw markdown symbols in DOCX output

### Problem
The `markdownToParagraphs` function in `generate-document/index.ts` is missing handlers for:
1. **`#####` (H5) headers** — rendered as raw `##### text` in the document
2. **`**bold**` lines that don't exactly match** — the current check requires the ENTIRE line to start AND end with `**`, but lines like `**Trimestre 4 (Meses 10-12)**` with parentheses inside may fail edge cases
3. **Deeper indented bullets** (`    - ` with 4+ spaces) — show as raw text instead of level-2 bullets

### Fix in `supabase/functions/generate-document/index.ts`

**Add H5 handler** (after the H4 block, ~line 235):
```typescript
} else if (line.startsWith("##### ")) {
  paragraphs.push(new Paragraph({
    heading: HeadingLevel.HEADING_5,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: line.slice(6), font: "Arial", size: 20, color: BRAND.text, bold: true })],
  }));
}
```

**Fix deeper indented bullets** — change the `  - ` check to also catch `    - ` (4-space and 6-space indents) as level-1 and level-2 bullets.

**Improve inline formatting** — the `parseInlineFormatting` function already handles `**bold**` inline. The issue is the whole-line bold check at line 268 (`line.startsWith("**") && line.endsWith("**")`) which works but runs AFTER headers/bullets. Lines that are standalone bold but also contain special chars should fall through to `parseInlineFormatting` cleanly — this already works. The real fix is just the missing H5.

### Files to modify
1. `supabase/functions/generate-document/index.ts` — add H5/H6 heading support, handle deeper bullet indentation
2. Redeploy edge function

