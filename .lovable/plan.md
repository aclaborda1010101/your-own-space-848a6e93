

## Problem

Line 1457 references `result6.text` but `result6` no longer exists — the pipeline now generates 5 parts, not 6. This crashes the entire enrichment block (lines 1451-1600+), causing:
- `result6 is not defined` error
- `fullPrd is not defined` (defined after the crash)
- Manifest never gets attached to output
- Validation never runs
- Linter never runs
- Cost recording fails

The PRD is saved via early save (line 1281-1334) so it's available, but without manifest, validation, or enrichment.

## Fix

### File: `supabase/functions/project-wizard-step/index.ts`

**Lines 1452-1457**: Remove `part6Text` and `result6` reference. Change to 5 parts only:

```typescript
let part1Text = result1.text;
let part2Text = result2.text;
let part3Text = result3.text;
let part4Text = result4.text;
let part5Text = result5.text;
```

**Line 1462 (runLinter)**: Change signature and body from 6 params to 5:
```typescript
const runLinter = (p1, p2, p3, p4, p5) => {
  const combined = [p1, p2, p3, p4, p5].join("\n\n");
```

**Line 1486**: Call with 5 args:
```typescript
const lintResult = runLinter(part1Text, part2Text, part3Text, part4Text, part5Text);
```

**Lines 1496-1498**: Build fullPrd from 5 parts:
```typescript
const fullPrd = [part1Text, part2Text, part3Text, part4Text, part5Text]
  .join("\n\n")
  .replace(/---END_PART_[1-5]---/g, "")
```

**Line 1524**: Remove `tokens_part6` from cost metadata.

**Line 1533**: Update prd_version to `"v13-lld"`.

Deploy `project-wizard-step` after changes.

