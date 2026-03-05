

# P0 Fix Plan — JARVIS v2 Close (3 Bugs + 2 Micro-Adjustments)

## Overview
Three surgical fixes across 4 files + edge function deploy. No prompt changes, no DB changes.

---

## File 1: `src/hooks/useProjectWizard.ts`
**Lines 374-390** — Inject `sourceOfTruthDocument` when re-running step 4

Replace the `stepData` block and `dataProfile` injection with:

```ts
      const stepData: Record<string, any> = {
        projectName: project.name,
        companyName: project.company,
        projectType: project.projectType,
        briefingJson: getStepOutput(2),
        scopeDocument: getStepOutput(3)?.document || getStepOutput(3),
        originalInput: project.inputContent,
        auditJson: getStepOutput(4),
        finalDocument: getStepOutput(5)?.document || getStepOutput(5),
        aiLeverageJson: getStepOutput(6),
        prdDocument: getStepOutput(7)?.document || getStepOutput(7),
      };

      // P0: When re-running audit (step 4), use final doc (step 5) as source of truth if available
      if (stepNumber === 4) {
        const finalDoc = getStepOutput(5)?.document || getStepOutput(5);
        if (finalDoc) {
          stepData.sourceOfTruthDocument = finalDoc;
          stepData.sourceStepNumber = 5;
        }
      }

      // Inject dataProfile for PRD generation (step 7)
      if (stepNumber === 7 && dataProfile) {
        stepData.dataProfile = dataProfile;
      }
```

Key: If F5 doesn't exist (first-run F4), no `sourceOfTruthDocument` is set — F4 falls through to step 3 draft as before.

---

## File 2: `supabase/functions/project-wizard-step/index.ts`
**Line 1482** — Use `sourceOfTruthDocument` with double fallback

Replace the single `userPrompt` assignment line with:

```ts
        // P0: Use final doc (step 5) as source of truth when re-running audit, fallback to step 3
        const documentUnderReview = sd.sourceOfTruthDocument ?? sd.finalDocument ?? scopeStr;
        const documentLabel = sd.sourceStepNumber === 5 ? "DOCUMENTO FINAL DE ALCANCE (Fase 5)" : "DOCUMENTO DE ALCANCE GENERADO (Fase 3)";
        const docReviewStr = truncate(typeof documentUnderReview === "string" ? documentUnderReview : JSON.stringify(documentUnderReview || {}, null, 2));

        userPrompt = `MATERIAL FUENTE ORIGINAL:\n${sd.originalInput || ""}\n\nBRIEFING EXTRAÍDO (Fase 2):\n${briefStr}\n\n${documentLabel}:\n${docReviewStr}\n\nRealiza una auditoría cruzada exhaustiva. Compara cada dato...
```

The rest of the `userPrompt` string (JSON schema instructions) stays identical — only the first 3 lines change to use `docReviewStr` and `documentLabel` instead of hardcoded `scopeStr`.

---

## File 3: `supabase/functions/generate-document/index.ts`

### A) Add `fixKnownBadPhrases` function (after line 1060, after `stripInternalOnly`)

```ts
function fixKnownBadPhrases(text: string): string {
  const fixes: [RegExp, string][] = [
    [/monitorización automática de fuentes\s+automátic[oa]/gi, "Monitorización automática de fuentes"],
  ];
  let result = text;
  for (const [pattern, replacement] of fixes) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
```

### B) Call it in the pipeline (after line 1465, after dedup step 2)

Insert after the dedup block:

```ts
    // Step 2b: Known bad phrases fix (post-dedup, pre-strip)
    if (typeof processedContent === "string") {
      processedContent = fixKnownBadPhrases(processedContent);
    }
```

---

## File 4: `src/pages/ProjectWizard.tsx`
**Lines 328-338** — Replace `onResolve` handler with global regex replacement

```tsx
        onResolve={(resolved) => {
          setShowContradictions(false);

          // Apply resolved values to the document text
          let doc = pendingApproveDoc || step3Data?.outputData?.document || "";
          let appliedCount = 0;

          contradictions.forEach((c, idx) => {
            const choice = resolved[idx];
            if (!choice) return;
            const valueToKeep = choice === "valor_1" ? c.valor_1 : c.valor_2;
            const valueToReplace = choice === "valor_1" ? c.valor_2 : c.valor_1;
            // Global replacement with escaped regex
            const escaped = valueToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escaped, 'g');
            if (re.test(doc)) {
              doc = doc.replace(re, valueToKeep);
              appliedCount++;
            }
          });

          setContradictions([]);
          toast.success(`Contradicciones resueltas: ${appliedCount} aplicadas`);
          approveStep(3, { document: doc });
          setPendingApproveDoc(undefined);
        }}
```

---

## Deploy

Redeploy edge functions: `generate-document` and `project-wizard-step`.

---

## Definition of Done

| Test | Expected |
|------|----------|
| A) Re-run F4 after F5 exists | Audits F5 content; no false positives for modules in final doc |
| B) Export doc with "Monitorización automática de fuentes automático" | Fixed to "Monitorización automática de fuentes" |
| C) Resolve contradictions in modal | Document text updated globally; modal doesn't reappear |
| D) First-run F4 (no F5 yet) | Falls back to step 3 draft normally — no error, no blocking |

