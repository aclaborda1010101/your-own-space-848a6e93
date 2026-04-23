// Entity resolver — fuzzy match contacts + projects mentioned in user transcript
// Used by jarvis-realtime and jarvis-gateway to enrich prompts and filter RAG.

export interface ResolvedContact {
  id: string;
  name: string;
  score?: number;
}

export interface ResolvedProject {
  id: string;
  name: string;
  score: number;
}

export interface EntityResolution {
  contacts: ResolvedContact[];
  projects: ResolvedProject[];
  promptBlock: string; // human-readable block to append to system prompt
  peopleIds: string[]; // for p_people in search_history_hybrid
}

// Spanish + English connectors that often precede a name.
// We extract candidate tokens following these particles, plus standalone capitalised words.
const CONNECTORS = [
  "con", "de", "sobre", "a", "para", "del", "contacto de", "proyecto de",
  "proyecto", "el contacto", "cliente", "el cliente", "la empresa", "empresa",
  "from", "with", "about", "client", "project",
];

// Stopwords we never treat as entities even if capitalised at sentence start
const STOP_CAPS = new Set([
  "Hola", "Buenas", "Qué", "Que", "Cómo", "Como", "Cuándo", "Cuando",
  "Dónde", "Donde", "Por", "Porqué", "Porque", "Pero", "Y", "O", "El", "La",
  "Los", "Las", "Un", "Una", "Yo", "Tú", "Tu", "Él", "Ella", "Ellos", "Nosotros",
  "Mi", "Su", "Sus", "Es", "Son", "Está", "Esta", "Este", "Esto", "Eso",
  "Hoy", "Ayer", "Mañana", "Ahora", "Después", "Antes", "Siempre", "Nunca",
  "Sí", "Si", "No", "Bien", "Mal", "Vale", "Ok", "Okay",
  "Jarvis", "Potus", "Adflux", // we still let user query "adflux" — separately allowed via fuzzy
]);

/**
 * Heuristic candidate extraction. Returns unique terms to fuzzy-match.
 * Strategy:
 *   1. After a known connector, take 1-3 capitalised words.
 *   2. Any standalone Capitalised token with len ≥ 4 not in stopwords.
 *   3. Any quoted "string".
 */
export function extractEntityCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // 1) Quoted strings
  const quoteRe = /["“]([^"”]{2,40})["”]/g;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(clean)) !== null) {
    candidates.add(m[1].trim());
  }

  // 2) After connectors → next 1-3 capitalised words
  const connRe = new RegExp(
    `\\b(?:${CONNECTORS.join("|")})\\s+([A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚÑáéíóúñ'-]{1,30}(?:\\s+[A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚÑáéíóúñ'-]{1,30}){0,2})`,
    "g",
  );
  while ((m = connRe.exec(clean)) !== null) {
    candidates.add(m[1].trim());
  }

  // 3) Standalone capitalised tokens
  const capRe = /\b([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'-]{3,30}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'-]{1,30}){0,2})\b/g;
  while ((m = capRe.exec(clean)) !== null) {
    const tok = m[1].trim();
    const first = tok.split(" ")[0];
    if (!STOP_CAPS.has(first)) candidates.add(tok);
  }

  // 4) Lowercased entire text — let fuzzy try whole short phrases for project names like "adflux"
  const words = clean.toLowerCase().match(/[a-záéíóúñ]{4,20}/g) || [];
  for (const w of words) {
    // only push tokens that look "name-ish": no common verbs/articles
    if (!/^(que|para|sobre|porque|tambien|tienes|hacer|tiene|estoy|estaba|cuando|donde|como|porqué|necesito|quisiera|debería|tendria|cuáles|cuales)$/.test(w)) {
      candidates.add(w);
    }
  }

  return Array.from(candidates).slice(0, 12); // cap to avoid explosion
}

/**
 * Resolve candidates against contacts + projects in parallel.
 * Returns the strongest matches and a prompt block to inject.
 */
export async function resolveEntities(
  supabase: any,
  userId: string,
  transcript: string,
): Promise<EntityResolution> {
  const empty: EntityResolution = {
    contacts: [],
    projects: [],
    promptBlock: "",
    peopleIds: [],
  };

  if (!transcript || !userId) return empty;

  const candidates = extractEntityCandidates(transcript);
  if (candidates.length === 0) return empty;

  const contactsByTerm = new Map<string, ResolvedContact>();
  const projectsByTerm = new Map<string, ResolvedProject>();

  // Run in parallel — both contacts + projects per candidate
  await Promise.all(
    candidates.flatMap((term) => [
      (async () => {
        try {
          const { data } = await supabase.rpc("search_contacts_fuzzy", {
            p_user_id: userId,
            p_search_term: term,
            p_limit: 2,
          });
          if (data && data.length > 0) {
            const top = data[0];
            const existing = contactsByTerm.get(top.id);
            if (!existing) contactsByTerm.set(top.id, { id: top.id, name: top.name });
          }
        } catch (_e) { /* ignore */ }
      })(),
      (async () => {
        try {
          const { data } = await supabase.rpc("search_projects_fuzzy", {
            p_user_id: userId,
            p_search_term: term,
            p_limit: 2,
          });
          if (data && data.length > 0) {
            const top = data[0];
            // Only accept high-confidence projects (score from pg_trgm)
            if ((top.score ?? 0) >= 0.3) {
              const existing = projectsByTerm.get(top.id);
              if (!existing) projectsByTerm.set(top.id, { id: top.id, name: top.name, score: top.score });
            }
          }
        } catch (_e) { /* ignore */ }
      })(),
    ]),
  );

  const contacts = Array.from(contactsByTerm.values()).slice(0, 5);
  const projects = Array.from(projectsByTerm.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (contacts.length === 0 && projects.length === 0) return empty;

  const lines: string[] = [];
  if (contacts.length > 0) {
    lines.push("Contactos mencionados:");
    for (const c of contacts) lines.push(`  • ${c.name} (id: ${c.id.slice(0, 8)})`);
  }
  if (projects.length > 0) {
    lines.push("Proyectos mencionados:");
    for (const p of projects) lines.push(`  • ${p.name} (id: ${p.id.slice(0, 8)}, match: ${(p.score * 100).toFixed(0)}%)`);
  }
  lines.push("→ Usa estos datos para responder con precisión. Si dos entidades empatan, pregunta para desambiguar antes de responder.");

  return {
    contacts,
    projects,
    promptBlock: "\n📇 ENTIDADES DETECTADAS:\n" + lines.join("\n"),
    peopleIds: contacts.map((c) => c.id),
  };
}
