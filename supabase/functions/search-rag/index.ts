import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { query, brain, limit = 10 } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query too short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[search-rag] Query: "${query.substring(0, 50)}..." brain=${brain || "all"}`);

    // Generate embedding for query
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      console.error("[search-rag] OpenAI embedding error:", err);
      return new Response(JSON.stringify({ error: "Error generating embedding" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search in conversation_embeddings using the SQL function
    const { data: matches, error: searchError } = await supabase.rpc("search_conversations", {
      query_embedding: queryEmbedding,
      p_user_id: userId,
      p_brain: brain || null,
      match_threshold: 0.65,
      match_count: limit,
    });

    if (searchError) {
      console.error("[search-rag] Search error:", searchError);
      return new Response(JSON.stringify({ error: "Search failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({
        answer: "No encontré información relevante en tus conversaciones sobre ese tema.",
        matches: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for Claude
    const contextChunks = matches.map((m: any, i: number) =>
      `[${i + 1}] Fecha: ${m.date} | Cerebro: ${m.brain} | Personas: ${m.people?.join(", ") || "N/A"}\n${m.content}`
    ).join("\n\n---\n\n");

    // Generate contextual answer with Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `Eres JARVIS, respondiendo una consulta sobre conversaciones pasadas del usuario. Usa SOLO la información del contexto proporcionado. Si no hay suficiente información, indícalo. Responde en español, de forma concisa y útil. Cita fechas y personas cuando sea relevante.`,
        messages: [{
          role: "user",
          content: `Pregunta del usuario: "${query}"\n\nContexto de conversaciones encontradas:\n${contextChunks}`,
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error("[search-rag] Claude error:", err);
      // Return matches without AI answer
      return new Response(JSON.stringify({
        answer: null,
        matches: matches.map((m: any) => ({
          date: m.date,
          brain: m.brain,
          people: m.people,
          summary: m.summary,
          similarity: m.similarity,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const answer = claudeData.content?.find((b: any) => b.type === "text")?.text || "";

    return new Response(JSON.stringify({
      answer,
      matches: matches.map((m: any) => ({
        date: m.date,
        brain: m.brain,
        people: m.people,
        summary: m.summary,
        similarity: m.similarity,
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[search-rag] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
