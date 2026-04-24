/**
 * f0-signal-preservation_test.ts — QA Paso 2 (F0+F1)
 *
 * Tests puros (sin LLM, sin red) sobre el helper exportado clampF0Result.
 * Verifican límites duros (LIMITS) y truncamiento de strings largos.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { clampF0Result, emptyF0Result } from "./f0-signal-preservation.ts";

function makeQuotes(n: number, baseLen = 100): { text: string; reason: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `quote ${i} ` + "x".repeat(Math.max(0, baseLen - 10)),
    reason: `reason ${i}`,
  }));
}

function makeEntities(n: number): { name: string; kind: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `entity_${i}`,
    kind: i % 2 === 0 ? "person" : "company",
  }));
}

function makeStrings(n: number, len = 50): string[] {
  return Array.from({ length: n }, (_, i) => `item_${i}_` + "y".repeat(Math.max(0, len - 8)));
}

Deno.test("clampF0Result: aplica todos los límites duros y truncamiento", () => {
  const longText = "L".repeat(800);
  const longReason = "R".repeat(400);

  const raw = {
    version: "1.0.0",
    golden_quotes: [
      ...makeQuotes(40),
      { text: longText, reason: longReason }, // entrará si <=25, pero superamos límite
    ],
    discarded_content_with_business_signal_candidates: makeQuotes(30),
    quantitative_signals: Array.from({ length: 35 }, (_, i) => ({
      text: `cifra ${i}`,
      metric_kind: "count",
    })),
    named_entities: makeEntities(60),
    external_sources_mentioned: makeStrings(25),
    data_assets_mentioned: makeStrings(25),
    business_catalyst_candidates: makeStrings(20),
    economic_pain_candidates: makeStrings(20),
    ambiguity_notes: makeStrings(15, 400), // textos > 300 chars
  };

  const out = clampF0Result(raw);

  assertEquals(out.version, "1.0.0");

  // Límites de cantidad
  assert(out.golden_quotes.length <= 25, `golden_quotes ${out.golden_quotes.length} > 25`);
  assert(
    out.discarded_content_with_business_signal_candidates.length <= 20,
    `discarded ${out.discarded_content_with_business_signal_candidates.length} > 20`,
  );
  assert(out.named_entities.length <= 50, `entities ${out.named_entities.length} > 50`);
  assert(out.quantitative_signals.length <= 30, `quants ${out.quantitative_signals.length} > 30`);
  assert(out.external_sources_mentioned.length <= 20);
  assert(out.data_assets_mentioned.length <= 20);
  assert(out.business_catalyst_candidates.length <= 15);
  assert(out.economic_pain_candidates.length <= 15);
  assert(out.ambiguity_notes.length <= 10);

  // _meta.truncated_fields debe registrar los campos saturados
  assert(out._meta?.generated === true, "_meta.generated debe ser true");
  const tf = out._meta?.truncated_fields ?? [];
  assert(tf.includes("golden_quotes"));
  assert(tf.includes("discarded_content_*"));
  assert(tf.includes("named_entities"));
  assert(tf.includes("quantitative_signals"));

  // Texto largo en ambiguity_notes debe quedar truncado <= 300 chars
  for (const note of out.ambiguity_notes) {
    assert(note.length <= 300, `ambiguity_note length ${note.length} > 300`);
  }
});

Deno.test("clampF0Result: trunca quotes a 500 chars con elipsis", () => {
  const longText = "A".repeat(800);
  const out = clampF0Result({
    golden_quotes: [{ text: longText, reason: "x" }],
  });
  assertEquals(out.golden_quotes.length, 1);
  assert(
    out.golden_quotes[0].text.length <= 500,
    `quote length ${out.golden_quotes[0].text.length} > 500`,
  );
  assert(out.golden_quotes[0].text.endsWith("…"), "quote larga debe acabar en elipsis");
});

Deno.test("clampF0Result: input vacío/inválido devuelve estructura coherente", () => {
  const out = clampF0Result({});
  assertEquals(out.version, "1.0.0");
  assertEquals(out.golden_quotes.length, 0);
  assertEquals(out.named_entities.length, 0);
  assertEquals(out._meta?.generated, true);
  // Sin saturación, no debe haber truncated_fields
  assertEquals(out._meta?.truncated_fields, undefined);
});

Deno.test("clampF0Result: filtra items con text/name vacíos", () => {
  const out = clampF0Result({
    golden_quotes: [{ text: "" }, { text: "ok" }, { reason: "no text" }],
    named_entities: [{ name: "" }, { name: "Carlos" }, { kind: "person" }],
  });
  assertEquals(out.golden_quotes.length, 1);
  assertEquals(out.golden_quotes[0].text, "ok");
  assertEquals(out.named_entities.length, 1);
  assertEquals(out.named_entities[0].name, "Carlos");
});

Deno.test("emptyF0Result: estructura mínima, generated=false", () => {
  const empty = emptyF0Result("test_error");
  assertEquals(empty.version, "1.0.0");
  assertEquals(empty.golden_quotes.length, 0);
  assertEquals(empty.named_entities.length, 0);
  assertEquals(empty._meta?.generated, false);
  assertEquals(empty._meta?.error, "test_error");
});
