/**
 * input-sampler.ts — Smart sampler for long extract inputs.
 *
 * Goal: keep the LLM input bounded (~85k–90k chars) WITHOUT losing critical
 * mid-document signal. Strategy:
 *   - Always preserve the head and tail of the document.
 *   - Around each occurrence of a "critical keyword", keep a ±2k window.
 *   - Deduplicate overlapping windows; prioritize keyword groups by criticality.
 *   - Annotate the output with explicit markers so the LLM knows it is sampled.
 *
 * Pure function — no IO, no LLM. Easy to unit-test.
 */

const SAMPLER_BUDGET = 90_000;
const SAMPLER_TRIGGER = 90_000;
const HEAD_CHARS = 30_000;
const TAIL_CHARS = 25_000;
const WINDOW_RADIUS = 2_000;

/** Keyword groups — ordered by priority (most critical first). */
const KEYWORD_PRIORITY_GROUPS: string[][] = [
  // 1. Muerte / herencia → señal de origen del proyecto
  ["muerte", "muertes", "fallecimiento", "fallecimientos", "herencia", "herencias", "esquela", "esquelas"],
  // 2. Llamadas grabadas / centralita / Whisper → activos de datos
  ["llamada", "llamadas", "grabada", "grabadas", "centralita", "Whisper"],
  // 3. Visitas / matching / comprador → casos de uso core
  ["3.000", "3000", "visitas", "71 visitas", "comprador", "compradores", "inversor", "inversores", "matching", "match", "vender antes", "antes de comprar"],
  // 4. Roles / propietarios → modelo de negocio
  ["roles", "7 roles", "siete roles", "propietario", "propietarios"],
  // 5. Benatar / BORME / CNAE / licencias / BOE / ayuntamiento → fuentes externas
  ["Benatar", "BORME", "BOE", "CNAE", "licencia", "licencias", "ayuntamiento"],
  // 6. Revista emocional / copy / HubSpot
  ["revista", "emocional", "copy", "HubSpot"],
  // 7. Soul / seguimiento / equipo
  ["seguimiento", "soy malo", "equipo no", "no lo entiende"],
  // 8. Compliance / DNI / profiling
  ["DNI", "dni", "datos personales", "profiling"],
  // 9. Otros nombres propios mencionados
  ["Teclofine", "Dapper", "BrainsRE", "WhatsApp"],
];

export interface PreservedWindow {
  keyword: string;
  start: number;
  end: number;
}

export interface PrepareLongInputResult {
  content: string;
  wasSampled: boolean;
  originalChars: number;
  sampledChars: number;
  strategy: string;
  preservedWindows: PreservedWindow[];
}

interface Range {
  start: number;
  end: number;
  keyword?: string;
}

/** Merge overlapping/adjacent ranges; preserves order. */
function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/** Find all case-insensitive occurrences of `needle` in `hay`. */
function findAllOccurrences(hay: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  const lowerHay = hay.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let from = 0;
  while (from < lowerHay.length) {
    const idx = lowerHay.indexOf(lowerNeedle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + Math.max(1, lowerNeedle.length);
  }
  return out;
}

export function prepareLongInputForExtract(raw: string): PrepareLongInputResult {
  const safe = raw ?? "";
  const originalChars = safe.length;

  if (originalChars <= SAMPLER_TRIGGER) {
    return {
      content: safe,
      wasSampled: false,
      originalChars,
      sampledChars: originalChars,
      strategy: "no_sampling",
      preservedWindows: [],
    };
  }

  // Reserve budget for head + tail; remaining is for keyword windows.
  const headEnd = Math.min(HEAD_CHARS, originalChars);
  const tailStart = Math.max(headEnd, originalChars - TAIL_CHARS);
  const headTailChars = headEnd + (originalChars - tailStart);
  const middleBudget = Math.max(0, SAMPLER_BUDGET - headTailChars);

  // Collect keyword windows in priority order; stop adding when budget hit.
  const preservedWindows: PreservedWindow[] = [];
  const middleRanges: Range[] = [];
  let middleUsed = 0;

  outer: for (const group of KEYWORD_PRIORITY_GROUPS) {
    for (const kw of group) {
      const occurrences = findAllOccurrences(safe, kw);
      for (const pos of occurrences) {
        // only consider middle occurrences (between head and tail)
        if (pos < headEnd || pos >= tailStart) continue;

        const start = Math.max(headEnd, pos - WINDOW_RADIUS);
        const end = Math.min(tailStart, pos + kw.length + WINDOW_RADIUS);
        if (end <= start) continue;

        const tentative = mergeRanges([...middleRanges, { start, end }]);
        const tentativeChars = tentative.reduce((acc, r) => acc + (r.end - r.start), 0);

        if (tentativeChars > middleBudget) {
          break outer;
        }

        middleRanges.length = 0;
        middleRanges.push(...tentative);
        middleUsed = tentativeChars;
        preservedWindows.push({ keyword: kw, start, end });
      }
    }
  }

  // Build the sampled output.
  const headSlice = safe.slice(0, headEnd);
  const tailSlice = safe.slice(tailStart);
  const middleSlices = middleRanges.map((r) => ({
    start: r.start,
    end: r.end,
    text: safe.slice(r.start, r.end),
  }));

  const middleBlock = middleSlices.length > 0
    ? middleSlices
        .map((s, i) =>
          `[VENTANA ${i + 1} — chars ${s.start}-${s.end}]\n${s.text}`,
        )
        .join("\n\n[----]\n\n")
    : "[Sin ventanas centrales preservadas — el material crítico está en cabecera/cola.]";

  const sampledChars = headEnd + middleUsed + (originalChars - tailStart);

  const content =
    `[INPUT LARGO MUESTREADO PARA EXTRACT]\n` +
    `Original: ${originalChars} chars\n` +
    `Muestreado: ${sampledChars} chars (head ${headEnd} + middle ${middleUsed} + tail ${originalChars - tailStart})\n` +
    `Estrategia: head + keyword windows + tail\n` +
    `\n[INICIO DEL MATERIAL]\n` +
    headSlice +
    `\n\n[VENTANAS PRESERVADAS POR KEYWORDS]\n` +
    middleBlock +
    `\n\n[FINAL DEL MATERIAL]\n` +
    tailSlice;

  return {
    content,
    wasSampled: true,
    originalChars,
    sampledChars,
    strategy: "head+keyword_windows+tail",
    preservedWindows,
  };
}
