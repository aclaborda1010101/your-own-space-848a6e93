

# Voice DNA Extractor + Contextual Drafts + Style Indicator UI

## Summary

Three changes: (1) Add stylometric voice analysis to `generate-response-draft` so suggestions mirror the user's actual writing style, (2) cross-reference personality_profile stress/business patterns into the prompt, (3) add a "detected style" indicator to the frontend UI.

---

## Part 1: SQL Migration

Add a `detected_style` TEXT column to `suggested_responses` to persist the detected writing style label (e.g., "Directo", "Sarcastico", "Tecnico").

```text
ALTER TABLE suggested_responses ADD COLUMN detected_style TEXT;
```

---

## Part 2: Edge Function `generate-response-draft` Overhaul

### 2a. Favorite-Only Gate

At the top, after fetching the contact, check `is_favorite`. If not true, return early with `{ ok: true, skipped: "not_favorite" }`. This prevents wasting AI resources on 1800+ non-priority contacts.

Update the contact SELECT to include `is_favorite`:
```text
.select("name, category, role, company, personality_profile, is_favorite")
```

### 2b. Voice Sampling (Stylometry)

Fetch the last 40 OUTGOING messages from `contact_messages` for this specific contact (direction = 'outgoing'). These represent how the user actually writes to this person.

```text
SELECT content FROM contact_messages
WHERE contact_id = X AND direction = 'outgoing'
ORDER BY message_date DESC LIMIT 40
```

Concatenate them into a `voiceSample` string.

### 2c. Two-Phase AI Call

**Phase 1 -- Style Analysis:** Send the voice sample to Gemini asking for a JSON analysis:
```text
{ 
  "estilo": "directo|sarcastico|tecnico|formal|coloquial",
  "patrones": "descripcion breve de patrones detectados",
  "vocabulario_clave": ["palabras", "recurrentes"],
  "longitud_media": "corta|media|larga",
  "usa_emojis": true/false,
  "nivel_formalidad": 1-10
}
```

**Phase 2 -- Draft Generation:** Inject the style analysis into the existing draft prompt with new rules:
- "Imita EXACTAMENTE el estilo de escritura del usuario. No intentes ser diplomatico ni amable si el usuario no lo es."
- Include the voice sample summary and key vocabulary
- Cross-reference personality_profile for stress keywords (ansiedad, fiebre, agotamiento) -> suggestion_2 must use the user's direct/brusque tone, not a polished empathetic tone
- Cross-reference business milestones (Arabia Saudi, Aicox, etc.) -> suggestion_1 goes straight to the next technical step

### 2d. Persist `detected_style`

Save the `estilo` value from Phase 1 into the `detected_style` column alongside the 3 suggestions.

---

## Part 3: Evolution Webhook Update

Currently the webhook triggers `generate-response-draft` for ALL incoming messages. Add a pre-check: only trigger if the contact `is_favorite = true`. This requires fetching `is_favorite` when resolving the contact (already fetching `id`, just add `is_favorite` to the select).

---

## Part 4: Frontend - Style Indicator

Update `SuggestedResponses.tsx`:

1. Add `detected_style` to the interface and fetch query
2. Display a badge below the header: "Estilo detectado: [Directo]" with appropriate color coding:
   - directo -> blue
   - sarcastico -> purple  
   - tecnico -> cyan
   - formal -> gray
   - coloquial -> green
3. Subscribe to the new column via Realtime (already receives full row on INSERT)

---

## Files Affected

| File | Change |
|------|--------|
| New SQL migration | ADD COLUMN detected_style to suggested_responses |
| `supabase/functions/generate-response-draft/index.ts` | Favorite gate + voice sampling + 2-phase AI + style persistence |
| `supabase/functions/evolution-webhook/index.ts` | Add is_favorite check before triggering draft generation |
| `src/components/contacts/SuggestedResponses.tsx` | Show detected_style badge |

## Execution Order

1. SQL migration (add column)
2. Edge function: generate-response-draft (full rewrite)
3. Edge function: evolution-webhook (favorite filter)
4. Frontend: style indicator UI
5. Deploy both edge functions

