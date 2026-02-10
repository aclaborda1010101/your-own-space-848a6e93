// RAG Loader - Loads knowledge base documents for specialized agents
// These RAGs provide domain expertise for each JARVIS module
// 
// NOTE: In Supabase Edge Functions, .md files are NOT bundled by the compiler.
// We import them as text modules so they're included in the bundle.

// Import RAGs as text - this ensures they're bundled with the edge function
import coachRag from "./rags/coach-personal-rag.md" with { type: "text" };
import nutritionRag from "./rags/nutricion-rag.md" with { type: "text" };
import englishRag from "./rags/english-teacher-rag.md" with { type: "text" };
import financeRag from "./rags/finanzas-rag.md" with { type: "text" };
import newsRag from "./rags/noticias-rag.md" with { type: "text" };
import boscoRag from "./rags/bosco-parenting-rag.md" with { type: "text" };
import iaFormacionRag from "./rags/ia-formacion-rag.md" with { type: "text" };
import contenidosRag from "./rags/contenidos-rag.md" with { type: "text" };

const RAG_CONTENT: Record<string, string> = {
  coach: coachRag,
  nutrition: nutritionRag,
  english: englishRag,
  finance: financeRag,
  news: newsRag,
  bosco: boscoRag,
  "ia-formacion": iaFormacionRag,
  contenidos: contenidosRag,
};

// Agent name mapping for consistent prompts
const AGENT_NAMES: Record<string, string> = {
  coach: "JARVIS Coach - Experto en coaching personal y desarrollo de hábitos",
  nutrition: "JARVIS Nutrición - Especialista en nutrición deportiva y personalizada",
  english: "JARVIS English Teacher - Experto en enseñanza de inglés para hispanohablantes",
  finance: "JARVIS Finanzas - Asesor financiero personal experto",
  news: "JARVIS Noticias - Curador experto de noticias de IA y tecnología",
  bosco: "JARVIS Bosco - Experto en desarrollo infantil y crianza consciente",
  "ia-formacion": "JARVIS IA Formación - Experto en Inteligencia Artificial y Machine Learning",
  contenidos: "JARVIS Contenidos - Experto en copywriting, storytelling y redacción cercana",
};

export type RAGKey = keyof typeof RAG_CONTENT;

/**
 * Load a RAG document by key (now synchronous since content is bundled)
 */
export async function loadRAG(ragKey: string): Promise<string> {
  return RAG_CONTENT[ragKey] || "";
}

/**
 * Get a section of RAG content (first N lines)
 */
export async function loadRAGSection(
  ragKey: string, 
  maxLines: number = 200
): Promise<string> {
  const fullContent = RAG_CONTENT[ragKey] || "";
  const lines = fullContent.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Build a standardized agent system prompt with RAG knowledge
 */
export async function buildAgentPrompt(
  ragKey: string,
  additionalContext?: string,
  maxLines: number = 300,
  _callerUrl?: string
): Promise<string> {
  const agentName = AGENT_NAMES[ragKey] || `JARVIS ${ragKey}`;
  const ragContent = await loadRAGSection(ragKey, maxLines);
  
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
export function getAgentName(ragKey: string): string {
  return AGENT_NAMES[ragKey] || `JARVIS ${ragKey}`;
}

/**
 * Load multiple RAGs at once
 */
export async function loadRAGs(ragKeys: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const key of ragKeys) {
    results[key] = RAG_CONTENT[key] || "";
  }
  return results;
}
