// RAG Loader - Loads knowledge base documents for specialized agents
// These RAGs provide domain expertise for each JARVIS module

// Import RAG content as text
const RAG_PATHS = {
  coach: "./rags/coach-personal-rag.md",
  nutrition: "./rags/nutricion-rag.md",
  english: "./rags/english-teacher-rag.md",
  finance: "./rags/finanzas-rag.md",
  news: "./rags/noticias-rag.md",
  bosco: "./rags/bosco-parenting-rag.md",
};

// Cache for loaded RAGs
const ragCache: Record<string, string> = {};

/**
 * Load a RAG document by key
 * @param ragKey - The key of the RAG to load (coach, nutrition, english, finance, news, bosco)
 * @returns The RAG content as a string
 */
export async function loadRAG(ragKey: keyof typeof RAG_PATHS): Promise<string> {
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
 * Get a summary section from a RAG (first N lines)
 * Useful for including partial context without overloading the prompt
 */
export async function loadRAGSection(
  ragKey: keyof typeof RAG_PATHS, 
  maxLines: number = 200
): Promise<string> {
  const fullContent = await loadRAG(ragKey);
  const lines = fullContent.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Load multiple RAGs at once
 */
export async function loadRAGs(ragKeys: Array<keyof typeof RAG_PATHS>): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    ragKeys.map(async (key) => {
      results[key] = await loadRAG(key);
    })
  );
  return results;
}

export type RAGKey = keyof typeof RAG_PATHS;
