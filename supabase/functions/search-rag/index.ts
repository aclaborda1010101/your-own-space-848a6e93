import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map brain filters to source_types for jarvis_history_chunks
const BRAIN_TO_SOURCES: Record<string, string[]> = {
  whatsapp: ["whatsapp"],
  email: ["email"],
  plaud: ["plaud"],
  transcription: ["transcription"],
  calendar: ["calendar"],
  health: ["manual"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
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

    const { query, brain, limit = 10, source_types, date_from, date_to } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query too short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[search-rag] Query: "${query.substring(0, 50)}..." brain=${brain || "all"} user=${userId.slice(0, 8)}`);

    // Generate BOTH embeddings in parallel:
    // - text-embedding-3-small (1024d) for jarvis_history_chunks (primary)
    // - text-embedding-ada-002 (1536d) for conversation_embeddings (legacy)
    const [smallEmbRes, adaEmbRes] = await Promise.all([
      fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: query, dimensions: 1024 }),
      }),
      fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-ada-002", input: query }),
      }),
    ]);

    if (!smallEmbRes.ok) {
      console.error("[search-rag] text-embedding-3-small error:", await smallEmbRes.text());
      return new Response(JSON.stringify({ error: "Error generating embedding" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smallEmbData = await smallEmbRes.json();
    const smallEmbedding = smallEmbData.data[0].embedding;

    // Determine source_types filter for history search
    const historySourceTypes = source_types
      ? source_types
      : brain && BRAIN_TO_SOURCES[brain]
        ? BRAIN_TO_SOURCES[brain]
        : null;

    // Search jarvis_history_chunks (primary — new unified RAG store)
    const historySearchPromise = supabase.rpc("search_history_hybrid", {
      p_user_id: userId,
      query_embedding: `[${smallEmbedding.join(",")}]`,
      query_text: query,
      p_source_types: historySourceTypes,
      p_people: null,
      p_date_from: date_from || null,
      p_date_to: date_to || null,
      p_min_importance: 1,
      match_count: Math.min(limit * 2, 20),
      rrf_k: 60,
    });

    // Search conversation_embeddings (legacy — for old transcription data)
    let legacySearchPromise: Promise<any> = Promise.resolve({ data: [], error: null });
    if (adaEmbRes.ok) {
      const adaEmbData = await adaEmbRes.json();
      const adaEmbedding = adaEmbData.data[0].embedding;
      legacySearchPromise = supabase.rpc("search_conversations", {
        query_embedding: adaEmbedding,
        p_user_id: userId,
        p_brain: brain || null,
        match_threshold: 0.65,
        match_count: Math.min(limit, 10),
      });
    }

    const [historyResult, legacyResult] = await Promise.all([historySearchPromise, legacySearchPromise]);

    if (historyResult.error) {
      console.warn("[search-rag] history search error:", historyResult.error.message);
    }
    if (legacyResult.error) {
      console.warn("[search-rag] legacy search error:", legacyResult.error.message);
    }

    // Merge results into a unified format
    const merged: Array<{
      source: string;
      date: string;
      type: string;
      people: string[];
      summary: string;
      content: string;
      score: number;
      metadata?: any;
    }> = [];

    // Add history chunks (primary)
    for (const h of historyResult.data || []) {
      merged.push({
        source: "history",
        date: h.occurred_at ? new Date(h.occurred_at).toISOString().split("T")[0] : "N/A",
        type: h.source_type || "unknown",
        people: h.people || [],
        summary: h.content_summary || "",
        content: h.content || "",
        score: h.rrf_score || h.similarity || 0,
        metadata: h.metadata,
      });
    }

    // Add legacy conversation matches (lower priority)
    const historyContentHashes = new Set(merged.map(m => m.content.slice(0, 100)));
    for (const m of legacyResult.data || []) {
      // Simple dedup: skip if content start matches
      if (historyContentHashes.has((m.content || "").slice(0, 100))) continue;
      merged.push({
        source: "legacy",
        date: m.date || "N/A",
        type: m.brain || "transcription",
        people: m.people || [],
        summary: m.summary || "",
        content: m.content || "",
        score: (m.similarity || 0) * 0.8, // slightly discount legacy results
      });
    }

    // Sort by score descending and take top `limit`
    merged.sort((a, b) => b.score - a.score);
    const topMatches = merged.slice(0, limit);

    if (topMatches.length === 0) {
      return new Response(JSON.stringify({
        answer: "No encontre informacion relevante en tu historial sobre ese tema.",
        matches: [],
        sources_searched: { history_chunks: (historyResult.data || []).length, legacy_conversations: (legacyResult.data || []).length },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for LLM answer synthesis
    const contextChunks = topMatches.map((m, i) => {
      const typeLabel = { whatsapp: "WhatsApp", email: "Email", transcription: "Transcripcion", plaud: "Plaud", calendar: "Calendario" }[m.type] || m.type;
      return `[${i + 1}] Fecha: ${m.date} | Tipo: ${typeLabel} | Personas: ${m.people?.length ? m.people.join(", ") : "N/A"}\n${m.content}`;
    }).join("\n\n---\n\n");

    // Try Lovable AI Gateway (Gemini) first, fall back to Claude
    let answer = "";
    const systemPrompt = `Eres JARVIS, un asistente personal inteligente. Responde la consulta del usuario usando SOLO la informacion del contexto proporcionado. Si no hay suficiente informacion, indicalo. Responde en espanol, de forma concisa y util. Cita fechas, personas y fuentes cuando sea relevante. No inventes informacion.`;
    const userContent = `Pregunta: "${query}"\n\nContexto encontrado en tu historial:\n${contextChunks}`;

    if (LOVABLE_API_KEY) {
      try {
        const geminiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        });
        if (geminiRes.ok) {
          const gj = await geminiRes.json();
          answer = gj.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (e) {
        console.warn("[search-rag] Gemini fallback failed:", e);
      }
    }

    // Fallback to Claude if Gemini didn't produce an answer
    if (!answer && ANTHROPIC_API_KEY) {
      try {
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
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          }),
        });
        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          answer = claudeData.content?.find((b: any) => b.type === "text")?.text || "";
        }
      } catch (e) {
        console.warn("[search-rag] Claude fallback failed:", e);
      }
    }

    return new Response(JSON.stringify({
      answer: answer || null,
      matches: topMatches.map(m => ({
        date: m.date,
        type: m.type,
        people: m.people,
        summary: m.summary,
        score: m.score,
        source: m.source,
      })),
      sources_searched: {
        history_chunks: (historyResult.data || []).length,
        legacy_conversations: (legacyResult.data || []).length,
      },
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
