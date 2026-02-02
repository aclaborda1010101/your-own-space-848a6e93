// RAG Loader - Loads knowledge base documents for specialized agents
// These RAGs provide domain expertise for each JARVIS module

const RAG_PATHS = {
  coach: "./rags/coach-personal-rag.md",
  nutrition: "./rags/nutricion-rag.md",
  english: "./rags/english-teacher-rag.md",
  finance: "./rags/finanzas-rag.md",
  news: "./rags/noticias-rag.md",
  bosco: "./rags/bosco-parenting-rag.md",
};

// Agent name mapping for consistent prompts
const AGENT_NAMES: Record<keyof typeof RAG_PATHS, string> = {
  coach: "JARVIS Coach - Experto en coaching personal y desarrollo de hábitos",
  nutrition: "JARVIS Nutrición - Especialista en nutrición deportiva y personalizada",
  english: "JARVIS English Teacher - Experto en enseñanza de inglés para hispanohablantes",
  finance: "JARVIS Finanzas - Asesor financiero personal experto",
  news: "JARVIS Noticias - Curador experto de noticias de IA y tecnología",
  bosco: "JARVIS Bosco - Experto en desarrollo infantil y crianza consciente",
};

// Cache for loaded RAGs
const ragCache: Record<string, string> = {};

export type RAGKey = keyof typeof RAG_PATHS;

/**
 * Load a RAG document by key
 */
export async function loadRAG(ragKey: RAGKey): Promise<string> {
  if (ragCache[ragKey]) {
    return ragCache[ragKey];
  }

  try {
    const path = RAG_PATHS[ragKey];
    const content = await Deno.readTextFile(new URL(path, import.meta.url));
    ragCache[ragKey] = content;
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
  maxLines: number = 200
): Promise<string> {
  const fullContent = await loadRAG(ragKey);
  const lines = fullContent.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Build a standardized agent system prompt with RAG knowledge
 * Pattern: "Eres un ${agentName}. Tu base de conocimiento es:\n${ragContent}\nResponde al usuario basándote en este conocimiento."
 */
export async function buildAgentPrompt(
  ragKey: RAGKey,
  additionalContext?: string,
  maxLines: number = 300
): Promise<string> {
  const agentName = AGENT_NAMES[ragKey];
  const ragContent = await loadRAGSection(ragKey, maxLines);
  
  let prompt = `Eres ${agentName}.

Tu base de conocimiento es:

${ragContent}

Responde al usuario basándote en este conocimiento.`;

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
export async function loadRAGs(ragKeys: RAGKey[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    ragKeys.map(async (key) => {
      results[key] = await loadRAG(key);
    })
  );
  return results;
}
