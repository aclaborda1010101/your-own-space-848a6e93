import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoscoObservation {
  observation_date: string;
  observation_notes: string;
  behavioral_data: {
    behaviors: string[];
    mood: string;
    social_interaction: string;
    concerns: string;
    questions: string;
  };
}

interface AnalysisResult {
  developmental_assessment: {
    stage: string;
    key_observations: string[];
    evidence: string[];
  };
  patterns_detected: Array<{
    pattern_name: string;
    pattern_type: string;
    confidence: number;
    significance: string;
    evidence: string[];
  }>;
  recommendations: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    category: string;
    evidence_based: string;
    next_steps: string[];
  }>;
  red_flags: Array<{
    flag: string;
    severity: "low" | "medium" | "high";
    recommendation: string;
  }>;
  frameworks_applied: string[];
  sources_cited: string[];
}

// Load RAG from Deno Deploy or inline
async function loadRAG(): Promise<any> {
  try {
    const ragUrl = new URL("../bosco-rag-base.json", import.meta.url);
    const response = await fetch(ragUrl);
    return await response.json();
  } catch (e) {
    console.error("Failed to load RAG from file, using fallback");
    return null;
  }
}

async function analyzeBoscoData(observation: BoscoObservation, rag: any): Promise<AnalysisResult> {
  // Build comprehensive prompt with RAG context
  const ragContext = rag ? buildRAGContext(rag) : "";

  const systemPrompt = `You are an expert child development analyst specializing in ages 3-6 years.

Your expertise spans:
- Piaget's Cognitive Development Theory
- Vygotsky's Sociocultural Theory & Scaffolding
- Montessori & Reggio Emilia educational approaches
- Attachment theory (Bowlby, Ainsworth)
- Applied Behavior Analysis (ABA)
- Play-based learning science
- Emotional regulation & executive function development

INSTRUCTIONS:
1. Analyze the observation using MULTIPLE frameworks
2. Identify developmental patterns and schemas
3. Provide SPECIFIC, EVIDENCE-BASED recommendations
4. Flag any developmental concerns
5. Always cite which frameworks/research informed your analysis
6. Return VALID JSON only

TONE: Professional but warm, evidence-based but practical, specific not generic.`;

  const userPrompt = `ANALYZE THIS OBSERVATION OF A 4-YEAR-OLD:

Date: ${observation.observation_date}
Notes: ${observation.observation_notes}
Behaviors observed: ${observation.behavioral_data.behaviors.join(", ") || "none specified"}
Mood: ${observation.behavioral_data.mood}
Social interactions: ${observation.behavioral_data.social_interaction}
Concerns: ${observation.behavioral_data.concerns || "none"}
Questions: ${observation.behavioral_data.questions || "none"}

${ragContext}

REQUIRED OUTPUT (valid JSON):
{
  "developmental_assessment": {
    "stage": "Which developmental stage based on observations?",
    "key_observations": ["Specific observation 1", "Specific observation 2"],
    "evidence": ["Why observation 1 matters...", "Why observation 2 matters..."]
  },
  "patterns_detected": [
    {
      "pattern_name": "Name of pattern",
      "pattern_type": "schema|emotional_cycle|engagement|social|cognitive",
      "confidence": 0.85,
      "significance": "Why this pattern matters",
      "evidence": ["Evidence point 1", "Evidence point 2"]
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "category": "activity|regulation|social|learning",
      "evidence_based": "Which framework/research supports this",
      "next_steps": ["Step 1", "Step 2"]
    }
  ],
  "red_flags": [
    {
      "flag": "Potential concern",
      "severity": "low|medium|high",
      "recommendation": "What to do about it"
    }
  ],
  "frameworks_applied": ["piaget_preop", "vygotsky_zpd", ...],
  "sources_cited": ["Author, Year - Key finding", ...]
}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  console.log("Calling Gemini 3 Pro for Bosco analysis...");

  let analysisText: string;
  try {
    analysisText = await chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });
  } catch (error) {
    console.error("Chat error:", error);
    throw new Error(`Failed to generate analysis: ${error.message}`);
  }

  // Parse JSON response
  let analysis: AnalysisResult;
  try {
    // Try to extract JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    analysis = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse analysis JSON:", e);
    console.error("Raw response:", analysisText.substring(0, 500));
    
    // Return safe default
    analysis = {
      developmental_assessment: {
        stage: "Unable to parse analysis",
        key_observations: [observation.observation_notes],
        evidence: ["Raw observation captured"]
      },
      patterns_detected: [],
      recommendations: [],
      red_flags: [],
      frameworks_applied: [],
      sources_cited: []
    };
  }

  return analysis;
}

function buildRAGContext(rag: any): string {
  if (!rag) return "";

  const frameworks = rag.frameworks?.map((f: any) => `- ${f.name}`).join("\n") || "";
  const indicators = rag.behavioral_indicators?.age_4_5?.map((i: any) => `- ${i.behavior}: ${i.meaning}`).slice(0, 5).join("\n") || "";

  return `REFERENCE FRAMEWORKS & INDICATORS:
Frameworks to consider: ${frameworks}

Key behavioral indicators for 4-5 years:
${indicators}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const observation: BoscoObservation = await req.json();

    // Validate input
    if (!observation.observation_date || !observation.observation_notes) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: observation_date, observation_notes" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Load RAG
    const rag = await loadRAG();

    // Analyze
    const analysis = await analyzeBoscoData(observation, rag);

    // Save to database
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Get user ID from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Insert analysis record
    const { data: record, error: dbError } = await supabase
      .from("bosco_analysis_sessions")
      .insert({
        user_id: user.id,
        observation_date: observation.observation_date,
        observation_notes: observation.observation_notes,
        behavioral_data: observation.behavioral_data,
        analysis_result: analysis,
        frameworks_applied: analysis.frameworks_applied,
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Don't fail the analysis, just log it
      console.warn("Failed to save analysis to DB, but returning analysis anyway");
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: record?.id,
        analysis: analysis,
        saved: !!record,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
