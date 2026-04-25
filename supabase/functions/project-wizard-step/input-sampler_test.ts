import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { prepareLongInputForExtract } from "./input-sampler.ts";

Deno.test("input-sampler: short input is returned untouched", () => {
  const raw = "Hola Benatar, hay 71 visitas y fallecimientos en el corpus.";
  const r = prepareLongInputForExtract(raw);
  assertEquals(r.wasSampled, false);
  assertEquals(r.content, raw);
  assertEquals(r.originalChars, raw.length);
  assertEquals(r.preservedWindows.length, 0);
  assertEquals(r.strategy, "no_sampling");
});

Deno.test("input-sampler: long input preserves head, tail and keyword windows", () => {
  // build ~150k chars of filler with keywords in the middle
  const filler = "lorem ipsum ".repeat(15_000); // ~180k
  const middleNeedleStart = 60_000;
  const middleNeedleEnd = 80_000;

  const before = filler.slice(0, middleNeedleStart);
  const middle =
    "..." +
    "Aquí hablamos de fallecimientos en herencias. " +
    "...".repeat(50) +
    "También de Benatar y BORME y CNAE. " +
    "...".repeat(50) +
    "Las llamadas grabadas en la centralita son clave. " +
    "...";
  const after = filler.slice(middleNeedleEnd);
  const raw = before + middle + after;

  assert(raw.length > 90_000, "fixture must be > 90k");

  const r = prepareLongInputForExtract(raw);
  assertEquals(r.wasSampled, true);
  assertEquals(r.originalChars, raw.length);
  assert(r.content.length <= 56_000, `content ${r.content.length} should be near budget (with markers)`);
  assert(r.content.includes("[INPUT LARGO MUESTREADO PARA EXTRACT]"));
  assert(r.content.includes("[INICIO DEL MATERIAL]"));
  assert(r.content.includes("[VENTANAS PRESERVADAS POR KEYWORDS]"));
  assert(r.content.includes("[FINAL DEL MATERIAL]"));

  // Head must contain the very first chars of raw
  assert(r.content.includes(raw.slice(0, 200)), "head not preserved");
  // Tail must contain the very last chars of raw
  assert(r.content.includes(raw.slice(-200)), "tail not preserved");

  // At least one critical keyword window preserved
  const kws = r.preservedWindows.map((w) => w.keyword.toLowerCase());
  assert(
    kws.some((k) => ["fallecimientos", "benatar", "llamadas", "grabadas", "centralita"].includes(k)),
    `expected critical keyword preserved, got ${JSON.stringify(kws)}`,
  );

  // Output must mention the keyword text itself
  assert(r.content.toLowerCase().includes("fallecimientos"));
});

Deno.test("input-sampler: overlapping keyword windows do not blow the budget", () => {
  // many keywords clustered in a small mid region → windows must be merged
  const head = "x".repeat(40_000);
  const cluster =
    "fallecimientos herencias llamadas grabadas centralita Benatar BORME CNAE Whisper ";
  const mid = cluster.repeat(200); // ~16k of densely packed keywords
  const tail = "y".repeat(60_000);
  const raw = head + mid + tail;

  const r = prepareLongInputForExtract(raw);
  assertEquals(r.wasSampled, true);
  // sampledChars must respect the budget
  assert(r.sampledChars <= 54_000, `sampledChars=${r.sampledChars} exceeded budget`);
  // We must have at least preserved one window from the cluster
  assert(r.preservedWindows.length >= 1);
});

Deno.test("input-sampler: empty/missing input is safe", () => {
  const r = prepareLongInputForExtract("");
  assertEquals(r.wasSampled, false);
  assertEquals(r.content, "");
  assertEquals(r.originalChars, 0);
});
