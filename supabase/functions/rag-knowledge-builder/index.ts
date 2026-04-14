import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BuilderRequest {
  specialist: string;
  topics: string[];
  user_id: string;
  mode?: "research" | "scrape" | "both";
}

const SPECIALIST_RESEARCH_PROMPTS: Record<string, string> = {
  coach: "Latest coaching methodologies, high performance habits, productivity frameworks, mental toughness techniques, executive coaching trends",
  nutrition: "Latest nutrition research, new diet studies, sports nutrition updates, supplement research, metabolic health",
  english: "Latest English teaching methodologies, language acquisition research, EdTech for language learning, CEFR updates",
  bosco: "Child development research 2025, early childhood education innovations, STEM for kids, emotional intelligence in children, Montessori research",
  "ia-formacion": "Latest AI developments, new LLM releases, AI agent frameworks, MCP protocol updates, AI coding tools, new papers in machine learning",
  "ia-kids": "Coding for kids trends, computational thinking education, AI literacy for children, Scratch programming projects",
  secretaria: "Productivity tools 2025, time management research, email management strategies, meeting efficiency, digital organization",
  contenidos: "Content marketing trends 2025, copywriting techniques, social media algorithms, storytelling frameworks",
};

async function searchWithPerplexity(query: string, apiKey: string): Promise<{ content: string; citations: string[] }> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "Eres un investigador experto. Proporciona información actualizada, precisa y bien estructurada. Responde en español. Incluye datos concretos, nombres de frameworks, herramientas y metodologías.",
        },
        { role: "user", content: query },
      ],
      search_recency_filter: "month",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Perplexity API error [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    console.warn(`Firecrawl error for ${url}: ${response.status}`);
    return "";
  }

  const data = await response.json();
  return data.data?.markdown || data.markdown || "";
}

async function processAndStore(
  supabase: any,
  userId: string,
  specialist: string,
  topic: string,
  rawContent: string,
  citations: string[]
) {
  // Process with Gemini to structure the content
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un editor de conocimiento experto. Tu trabajo es tomar contenido en bruto de investigación y convertirlo en conocimiento estructurado, conciso y útil para un agente de IA especialista en "${specialist}".

REGLAS:
- Extraer SOLO información práctica y accionable
- Estructurar con headers markdown claros
- Máximo 500 palabras
- Incluir datos concretos, nombres, frameworks
- Eliminar redundancias y relleno
- Formato: bullet points y listas
- En español`,
    },
    {
      role: "user",
      content: `Procesa este contenido sobre "${topic}" para el especialista ${specialist}:\n\n${rawContent.substring(0, 8000)}`,
    },
  ];

  const processed = await chat(messages, {
    model: "gemini-flash",
    temperature: 0.3,
  });

  if (!processed) return;

  // Store in specialist_knowledge
  const { error } = await supabase.from("specialist_knowledge").insert({
    user_id: userId,
    specialist,
    category: topic,
    title: `${specialist} - ${topic} (auto-generated)`,
    content: processed,
    source_url: citations[0] || null,
    source_type: "perplexity_research",
    importance: 7,
    is_active: true,
  });

  if (error) {
    console.error(`Error storing knowledge: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!perplexityKey) {
      throw new Error("PERPLEXITY_API_KEY not configured");
    }

    const { specialist, topics, user_id, mode = "research" } = await req.json() as BuilderRequest;

    if (!specialist || !user_id) {
      throw new Error("specialist and user_id are required");
    }

    const researchTopics = topics?.length > 0
      ? topics
      : [SPECIALIST_RESEARCH_PROMPTS[specialist] || `Latest updates in ${specialist}`];

    console.log(`[RAG Builder] Starting research for ${specialist}, topics: ${researchTopics.length}`);

    const results: Array<{ topic: string; status: string }> = [];

    for (const topic of researchTopics) {
      try {
        // Research with Perplexity
        const query = `${topic}. Proporciona las últimas actualizaciones, herramientas, metodologías y tendencias. Incluye datos concretos y fuentes.`;
        const { content, citations } = await searchWithPerplexity(query, perplexityKey);

        let enrichedContent = content;

        // Optionally scrape top citations for deeper content
        if ((mode === "scrape" || mode === "both") && firecrawlKey && citations.length > 0) {
          const topUrls = citations.slice(0, 2);
          for (const url of topUrls) {
            try {
              const scraped = await scrapeWithFirecrawl(url, firecrawlKey);
              if (scraped) {
                enrichedContent += `\n\n--- Fuente: ${url} ---\n${scraped.substring(0, 3000)}`;
              }
            } catch (e) {
              console.warn(`Scrape failed for ${url}:`, e);
            }
          }
        }

        // Process and store
        await processAndStore(supabase, user_id, specialist, topic, enrichedContent, citations);
        results.push({ topic, status: "success" });
        console.log(`[RAG Builder] ✓ Processed: ${topic}`);
      } catch (topicError: unknown) {
        const msg = topicError instanceof Error ? topicError.message : "Unknown error";
        console.error(`[RAG Builder] ✗ Failed: ${topic} - ${msg}`);
        results.push({ topic, status: `error: ${msg}` });
      }
    }

    return new Response(
      JSON.stringify({ success: true, specialist, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[RAG Builder] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
