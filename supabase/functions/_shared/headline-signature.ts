// Normalización de títulos de "asunto pendiente" para detectar variantes léxicas
// del mismo asunto. Mismo patrón que detect-task-signals para coherencia.

const FILLER_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "de", "del", "al", "a", "en", "con", "por", "para", "sin", "sobre",
  "que", "qué", "como", "cómo", "cuando", "cuándo", "donde", "dónde",
  "y", "o", "u", "ni", "pero", "mas",
  "es", "son", "ser", "estar", "está", "están", "fue", "fueron", "haber", "ha", "han", "he",
  "le", "lo", "se", "su", "sus", "mi", "mis", "tu", "tus", "nos", "os",
  "esta", "este", "estos", "estas", "ese", "esa", "esos", "esas",
  "muy", "más", "menos", "tan", "ya", "no", "si",
  "crear", "hacer", "tener", "dar", "poner", "decir", "ir", "venir",
  "añadir", "anadir", "agregar", "preguntar", "ver", "mirar", "revisar",
  "lo", "le",
]);

export function normalizeHeadlineTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes
    .replace(/[^a-z0-9\s]/g, " ") // signos
    .replace(/\d+/g, " ") // números (3 usuarios = usuarios)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
    .sort()
    .join(" ")
    .trim();
}

export async function generateSignature(text: string): Promise<string> {
  const normalized = normalizeHeadlineTitle(text);
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
