// RAG Loader - Loads knowledge base documents for specialized agents
// These RAGs provide domain expertise for each JARVIS module

const RAG_PATHS = {
  coach: "rags/coach-personal-rag.md",
  nutrition: "rags/nutricion-rag.md",
  english: "rags/english-teacher-rag.md",
  finance: "rags/finanzas-rag.md",
  news: "rags/noticias-rag.md",
  bosco: "rags/bosco-parenting-rag.md",
  "ia-formacion": "rags/ia-formacion-rag.md",
  contenidos: "rags/contenidos-rag.md",
};

// Agent name mapping for consistent prompts
const AGENT_NAMES: Record<keyof typeof RAG_PATHS, string> = {
  coach: "JARVIS Coach - Experto en coaching personal y desarrollo de hábitos",
  nutrition: "JARVIS Nutrición - Especialista en nutrición deportiva y personalizada",
  english: "JARVIS English Teacher - Experto en enseñanza de inglés para hispanohablantes",
  finance: "JARVIS Finanzas - Asesor financiero personal experto",
  news: "JARVIS Noticias - Curador experto de noticias de IA y tecnología",
  bosco: "JARVIS Bosco - Experto en desarrollo infantil y crianza consciente",
  "ia-formacion": "JARVIS IA Formación - Experto en Inteligencia Artificial y Machine Learning",
  contenidos: "JARVIS Contenidos - Experto en copywriting, storytelling y redacción cercana",
};

// Cache for loaded RAGs
const ragCache: Record<string, string> = {};

export type RAGKey = keyof typeof RAG_PATHS;

/**
 * Try multiple path strategies to find the RAG file.
 * Edge functions bundle _shared into the function dir, so we try:
 * 1. Relative to the caller's import.meta.url (if provided)
 * 2. Relative to this file's import.meta.url
 * 3. Absolute path from known Deno deploy structure
 */
async function tryReadFile(relativePath: string, callerUrl?: string): Promise<string> {
  const attempts: string[] = [];

  // Strategy 1: relative to this module (works when called from _shared or same dir)
  try {
    const url1 = new URL(`./${relativePath}`, import.meta.url);
    attempts.push(url1.pathname);
    return await Deno.readTextFile(url1);
  } catch { /* continue */ }

  // Strategy 2: relative to caller if provided
  if (callerUrl) {
    try {
      const url2 = new URL(`../_shared/${relativePath}`, callerUrl);
      attempts.push(url2.pathname);
      return await Deno.readTextFile(url2);
    } catch { /* continue */ }
  }

  // Strategy 3: try going up from this file to _shared
  try {
    const url3 = new URL(`../_shared/${relativePath}`, import.meta.url);
    attempts.push(url3.pathname);
    return await Deno.readTextFile(url3);
  } catch { /* continue */ }

  // Strategy 4: try relative path with ./ prefix from _shared parent
  try {
    const url4 = new URL(`./../_shared/${relativePath}`, import.meta.url);
    attempts.push(url4.pathname);
    return await Deno.readTextFile(url4);
  } catch { /* continue */ }

  console.warn(`RAG file not found after trying paths: ${attempts.join(', ')}`);
  return "";
}

/**
 * Load a RAG document by key
 * @param callerUrl - Pass import.meta.url from the calling edge function for better path resolution
 */
export async function loadRAG(ragKey: RAGKey, callerUrl?: string): Promise<string> {
  if (ragCache[ragKey]) {
    return ragCache[ragKey];
  }

  try {
    const path = RAG_PATHS[ragKey];
    const content = await tryReadFile(path, callerUrl);
    if (content) {
      ragCache[ragKey] = content;
    }
    return content;
  } catch (error) {
    console.error(`Error loading RAG ${ragKey}:`, error);
    return "";
  }
}

/**
 * Get a section of RAG content (first N lines)
 */
export async function loadRAGSection(
  ragKey: RAGKey, 
  maxLines: number = 200,
  callerUrl?: string
): Promise<string> {
  const fullContent = await loadRAG(ragKey, callerUrl);
  const lines = fullContent.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Build a standardized agent system prompt with RAG knowledge
 */
export async function buildAgentPrompt(
  ragKey: RAGKey,
  additionalContext?: string,
  maxLines: number = 300,
  callerUrl?: string
): Promise<string> {
  const agentName = AGENT_NAMES[ragKey];
  const ragContent = await loadRAGSection(ragKey, maxLines, callerUrl);
  
  let prompt = `Eres ${agentName}.`;

  if (ragContent) {
    prompt += `\n\nTu base de conocimiento es:\n\n${ragContent}\n\nResponde al usuario basándote en este conocimiento.`;
  } else {
    prompt += `\n\nResponde al usuario con tu experiencia como ${agentName}.`;
  }

  if (additionalContext) {
    prompt += `\n\n${additionalContext}`;
  }

  return prompt;
}

/**
 * Get agent name for a RAG key
 */
export function getAgentName(ragKey: RAGKey): string {
  return AGENT_NAMES[ragKey];
}

/**
 * Load multiple RAGs at once
 */
export async function loadRAGs(ragKeys: RAGKey[], callerUrl?: string): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    ragKeys.map(async (key) => {
      results[key] = await loadRAG(key, callerUrl);
    })
  );
  return results;
}
