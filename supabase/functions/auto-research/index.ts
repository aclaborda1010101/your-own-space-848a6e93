import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { project_id, url } = await req.json();
    if (!project_id || !url) {
      return new Response(JSON.stringify({ error: "project_id and url required" }), { status: 400, headers: corsHeaders });
    }

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("business_projects")
      .select("id, name, company")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: corsHeaders });
    }

    console.log(`[auto-research] Starting research for project ${project_id}, URL: ${url}`);

    // ═══════════════════════════════════════
    // PHASE 1: Firecrawl scrape
    // ═══════════════════════════════════════
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    let scrapedContent = "";
    let scrapedMetadata: any = {};

    if (firecrawlKey) {
      try {
        let formattedUrl = url.trim();
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
          formattedUrl = `https://${formattedUrl}`;
        }

        console.log("[auto-research] Scraping URL with Firecrawl:", formattedUrl);
        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });

        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json();
          scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || "";
          scrapedMetadata = scrapeData.data?.metadata || scrapeData.metadata || {};
          console.log(`[auto-research] Scraped ${scrapedContent.length} chars`);
        } else {
          console.error("[auto-research] Firecrawl error:", await scrapeRes.text());
        }
      } catch (e) {
        console.error("[auto-research] Firecrawl exception:", e);
      }
    } else {
      console.warn("[auto-research] FIRECRAWL_API_KEY not found, skipping scrape");
    }

    // ═══════════════════════════════════════
    // PHASE 2: Perplexity external research
    // ═══════════════════════════════════════
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    let externalResearch = "";

    const companyName = project.company || project.name || new URL(url.startsWith("http") ? url : `https://${url}`).hostname;

    if (perplexityKey) {
      try {
        console.log("[auto-research] Running Perplexity research for:", companyName);
        const pplxRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content: "Eres un investigador de empresas. Responde en español con datos verificables y concisos."
              },
              {
                role: "user",
                content: `Investiga la empresa "${companyName}" (${url}). Dame:
1. Noticias recientes y menciones relevantes (último año)
2. Competidores directos principales
3. Estado del sector: tendencias, regulación, problemas conocidos
4. Reseñas de clientes si hay (puntuación media, quejas recurrentes)
5. Presencia en directorios sectoriales
6. Datos públicos relevantes (premios, certificaciones, sanciones)

Sé conciso pero completo. Si no encuentras algo, indícalo.`
              }
            ],
            search_recency_filter: "year",
          }),
        });

        if (pplxRes.ok) {
          const pplxData = await pplxRes.json();
          externalResearch = pplxData.choices?.[0]?.message?.content || "";
          console.log(`[auto-research] Perplexity returned ${externalResearch.length} chars`);
        } else {
          console.error("[auto-research] Perplexity error:", await pplxRes.text());
        }
      } catch (e) {
        console.error("[auto-research] Perplexity exception:", e);
      }
    } else {
      console.warn("[auto-research] PERPLEXITY_API_KEY not found, skipping external research");
    }

    // ═══════════════════════════════════════
    // PHASE 3: AI structuring with Gemini
    // ═══════════════════════════════════════
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    let structuredContext: any = {};

    if (geminiKey && (scrapedContent || externalResearch)) {
      try {
        const structurePrompt = `Analiza esta información sobre una empresa y estructura los datos.

WEB SCRAPE:
${scrapedContent.slice(0, 8000)}

RESEARCH EXTERNO:
${externalResearch.slice(0, 6000)}

URL: ${url}
Nombre empresa: ${companyName}

Responde SOLO con JSON válido:
{
  "company_name": "nombre de la empresa",
  "company_description": "descripción en 2-3 frases",
  "sector_detected": "sector principal (ej: Farmacia, Fintech, Retail, etc.)",
  "geography_detected": "ubicación/zona de operación",
  "products_services": ["producto/servicio 1", "producto/servicio 2"],
  "tech_stack_detected": ["tecnología visible 1", "tecnología 2"],
  "social_media": {"linkedin": "url o null", "twitter": "url o null", "instagram": "url o null", "web": "${url}"},
  "competitors": [{"name": "competidor", "description": "breve"}],
  "reviews_summary": {"average_score": null, "total_reviews": null, "common_complaints": [], "common_praise": []},
  "sector_trends": ["tendencia 1", "tendencia 2"],
  "news_mentions": [{"title": "título", "date": "fecha aprox", "summary": "resumen"}],
  "public_data": {"certifications": [], "awards": [], "sanctions": []},
  "confidence_score": 0.75
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: structurePrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseMimeType: "application/json" },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          let cleaned = text.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          structuredContext = JSON.parse(cleaned.trim());
          console.log("[auto-research] Structured context generated successfully");
        } else {
          console.error("[auto-research] Gemini error:", await geminiRes.text());
        }
      } catch (e) {
        console.error("[auto-research] Gemini structuring exception:", e);
      }
    }

    // ═══════════════════════════════════════
    // PHASE 4: Save to project_context
    // ═══════════════════════════════════════
    const rawResearch = `=== WEB SCRAPE ===\n${scrapedContent.slice(0, 10000)}\n\n=== EXTERNAL RESEARCH ===\n${externalResearch.slice(0, 8000)}`;

    // Delete existing context for this project first
    await supabase.from("project_context").delete().eq("project_id", project_id);

    const { data: contextRow, error: insertError } = await supabase.from("project_context").insert({
      project_id,
      user_id: userId,
      source_url: url,
      company_name: structuredContext.company_name || companyName,
      company_description: structuredContext.company_description || null,
      sector_detected: structuredContext.sector_detected || null,
      geography_detected: structuredContext.geography_detected || null,
      products_services: structuredContext.products_services || [],
      tech_stack_detected: structuredContext.tech_stack_detected || [],
      social_media: structuredContext.social_media || {},
      competitors: structuredContext.competitors || [],
      reviews_summary: structuredContext.reviews_summary || {},
      sector_trends: structuredContext.sector_trends || [],
      news_mentions: structuredContext.news_mentions || [],
      public_data: structuredContext.public_data || {},
      raw_research: rawResearch,
      confidence_score: structuredContext.confidence_score || 0.5,
    }).select().single();

    if (insertError) {
      console.error("[auto-research] Insert error:", insertError);
      throw insertError;
    }

    console.log("[auto-research] Context saved successfully:", contextRow?.id);

    return new Response(JSON.stringify({ success: true, context: contextRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[auto-research] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
