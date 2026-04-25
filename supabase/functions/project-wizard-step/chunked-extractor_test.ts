/**
 * chunked-extractor_test.ts — Unit tests for split + merge (no LLM calls).
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { splitInputIntoChunks, mergeChunkBriefs } from "./chunked-extractor.ts";

Deno.test("splitInputIntoChunks: short input returns single chunk", () => {
  const text = "hello world".repeat(100); // ~1100 chars
  const chunks = splitInputIntoChunks(text);
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0].chunk_id, "CHUNK-001");
  assertEquals(chunks[0].char_start, 0);
  assertEquals(chunks[0].char_end, text.length);
  assertEquals(chunks[0].text, text);
});

Deno.test("splitInputIntoChunks: 200k chars produces multiple chunks with overlap", () => {
  const text = "a".repeat(200_000);
  const chunks = splitInputIntoChunks(text);
  assert(chunks.length >= 5, `expected ≥5 chunks, got ${chunks.length}`);
  assert(chunks.length <= 8, `expected ≤8 chunks (cap), got ${chunks.length}`);

  // First chunk has no overlap_before.
  assertEquals(chunks[0].overlap_before, 0);

  // Subsequent chunks have overlap.
  for (let i = 1; i < chunks.length; i++) {
    assert(chunks[i].overlap_before > 0, `chunk ${i} should have overlap_before > 0`);
  }

  // Chunks should cover the input contiguously (modulo overlap).
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    const cur = chunks[i];
    // cur.char_start <= prev.char_end (because of overlap)
    assert(cur.char_start <= prev.char_end, `chunk ${i} should start at or before previous end`);
  }
});

Deno.test("splitInputIntoChunks: prefers natural boundary near target", () => {
  // Build text with a clear paragraph break near 35k.
  const before = "x".repeat(34_500);
  const breakMarker = "\n\n--- BREAK ---\n\n";
  const after = "y".repeat(50_000);
  const text = before + breakMarker + after;

  const chunks = splitInputIntoChunks(text);
  assert(chunks.length >= 2);

  // First chunk should end at or near the break (within ±2k).
  const firstEnd = chunks[0].char_end;
  const breakStart = before.length;
  assert(
    Math.abs(firstEnd - breakStart) < 2_500,
    `first chunk should end near the break (${breakStart}), got ${firstEnd}`,
  );
});

Deno.test("mergeChunkBriefs: deduplicates identical items and merges _source_chunks", async () => {
  const briefs = [
    {
      chunk_id: "CHUNK-001",
      observed_facts: [
        { title: "3000 llamadas grabadas en centralita", description: "...", _source_chunks: ["CHUNK-001"] },
        { title: "Fallecimientos detectados via esquelas", description: "...", _source_chunks: ["CHUNK-001"] },
      ],
      source_quotes: ["llamamos a las familias"],
    },
    {
      chunk_id: "CHUNK-002",
      observed_facts: [
        { title: "3000 llamadas grabadas en centralita", description: "...", _source_chunks: ["CHUNK-002"] }, // duplicate
        { title: "71 visitas en 9 meses", description: "...", _source_chunks: ["CHUNK-002"] },
      ],
      source_quotes: ["llamamos a las familias", "tenemos 71 visitas"],
    },
  ];

  const result = await mergeChunkBriefs(briefs as any, { projectName: "AFFLUX", companyName: "Test" }, { synthesizeNarrative: false });
  const facts = result.briefing.business_extraction_v2.observed_facts;

  // 3 unique facts expected.
  assertEquals(facts.length, 3, `expected 3 unique facts, got ${facts.length}`);

  // The duplicated fact should have both source_chunks.
  const llamadas = facts.find((f: any) => f.title.includes("3000 llamadas"));
  assert(llamadas, "should find the llamadas fact");
  assertEquals(llamadas._source_chunks.sort(), ["CHUNK-001", "CHUNK-002"]);
  assertEquals(llamadas._evidence_count, 2);
  assertEquals(llamadas.certainty, "high");

  // source_quotes deduplicated.
  assertEquals(result.briefing.business_extraction_v2.source_quotes.length, 2);
});

Deno.test("mergeChunkBriefs: empty input throws", async () => {
  let threw = false;
  try {
    await mergeChunkBriefs([], { projectName: "X", companyName: "Y" }, { synthesizeNarrative: false });
  } catch {
    threw = true;
  }
  assert(threw, "should throw on empty input");
});
