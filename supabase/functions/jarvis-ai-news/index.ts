import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fuentes de noticias IA
const NEWS_SOURCES = {
  spanish: [
    { name: "Dot CSV (Carlos Santana)", type: "youtube", url: "https://www.youtube.com/@DotCSV" },
    { name: "CodingTube", type: "youtube", url: "https://www.youtube.com/@CodingTube" },
    { name: "Xataka", type: "web", url: "https://www.xataka.com/tag/inteligencia-artificial" },
    { name: "El Confidencial Tech", type: "web", url: "https://www.elconfidencial.com/tecnologia/" },
  ],
  international: [
    { name: "OpenAI Blog", type: "blog", url: "https://openai.com/blog" },
    { name: "Anthropic News", type: "blog", url: "https://www.anthropic.com/news" },
    { name: "Google AI Blog", type: "blog", url: "https://ai.googleblog.com/" },
    { name: "The Verge AI", type: "web", url: "https://www.theverge.com/ai-artificial-intelligence" },
    { name: "Ars Technica AI", type: "web", url: "https://arstechnica.com/ai/" },
    { name: "MIT Tech Review", type: "web", url: "https://www.technologyreview.com/topic/artificial-intelligence/" },
    { name: "Hugging Face Papers", type: "papers", url: "https://huggingface.co/papers" },
  ],
  youtube: [
    { name: "Two Minute Papers", channel: "Two Minute Papers", focus: "Research papers explained" },
    { name: "Yannic Kilcher", channel: "Yannic Kilcher", focus: "Deep ML paper reviews" },
    { name: "AI Explained", channel: "AI Explained", focus: "AI news and analysis" },
    { name: "Matt Wolfe", channel: "Matt Wolfe", focus: "AI tools and news" },
    { name: "The AI Advantage", channel: "The AI Advantage", focus: "Practical AI applications" },
    { name: "Fireship", channel: "Fireship", focus: "Tech/AI quick updates" },
  ],
  twitter: [
    "@sama", "@ylecun", "@kaborali", "@emaborali", "@AndrewYNg", "@hardmaru"
  ]
};

interface NewsRequest {
  action: "get_sources" | "summarize_recent" | "search_topic";
  topic?: string;
  hours?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, topic, hours = 48 }: NewsRequest = await req.json();

    if (action === "get_sources") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sources: NEWS_SOURCES 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "summarize_recent") {
      // Generate AI news summary using Gemini's knowledge
      const systemPrompt = `Eres un experto curador de noticias de Inteligencia Artificial.

Tu tarea es proporcionar un resumen de las noticias más relevantes de IA de las últimas ${hours} horas.

FORMATO DE RESPUESTA (JSON):
{
  "summary": "Resumen ejecutivo de 2-3 líneas",
  "categories": {
    "llms": [{"title": "...", "description": "...", "importance": "high/medium/low", "source": "..."}],
    "vision": [...],
    "robotics": [...],
    "tools": [...],
    "research": [...],
    "business": [...]
  },
  "top_story": {
    "title": "...",
    "description": "...",
    "why_matters": "..."
  },
  "spanish_relevant": [
    {"title": "...", "description": "...", "source": "..."}
  ]
}

REGLAS:
1. Prioriza noticias con impacto práctico
2. Incluye al menos 1-2 noticias relevantes para el mercado español
3. Sé conciso pero informativo
4. Indica nivel de importancia
5. Si no hay noticias confirmadas de las últimas horas, indica "basado en tendencias recientes"`;

      const userPrompt = `Dame un resumen de las noticias más importantes de IA de las últimas ${hours} horas. 
      
Incluye:
- Actualizaciones de OpenAI, Anthropic, Google, Meta
- Nuevos modelos o herramientas
- Papers relevantes
- Noticias de negocio/inversión
- Contenido relevante de creadores españoles (Dot CSV, etc.)

Responde en JSON válido.`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      const response = await chat(messages, {
        model: "gemini-flash",
        temperature: 0.3,
        responseFormat: "json"
      });

      let newsData;
      try {
        newsData = JSON.parse(response);
      } catch {
        // If JSON parse fails, return the raw response
        newsData = { raw_response: response, parse_error: true };
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          generated_at: new Date().toISOString(),
          hours_covered: hours,
          news: newsData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "search_topic" && topic) {
      const systemPrompt = `Eres un experto en IA. Proporciona información actualizada sobre el tema solicitado.

FORMATO (JSON):
{
  "topic": "${topic}",
  "summary": "Resumen del estado actual",
  "recent_developments": ["..."],
  "key_players": ["..."],
  "resources": [{"name": "...", "url": "...", "type": "article/video/paper"}],
  "spanish_resources": [{"name": "...", "description": "..."}]
}`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Información actualizada sobre: ${topic}. Responde en JSON.` }
      ];

      const response = await chat(messages, {
        model: "gemini-flash",
        temperature: 0.3,
        responseFormat: "json"
      });

      let topicData;
      try {
        topicData = JSON.parse(response);
      } catch {
        topicData = { raw_response: response };
      }

      return new Response(
        JSON.stringify({ success: true, data: topicData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI News error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
