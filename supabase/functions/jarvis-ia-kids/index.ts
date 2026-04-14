import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getIaKidsContext(supabase: any, userId: string) {
  const [boscoProfileRes, activitiesRes, memoriesRes] = await Promise.all([
    supabase.from("bosco_profile").select("gardner_scores, personality_traits, development_areas, focus_areas")
      .eq("user_id", userId).single(),
    supabase.from("bosco_activities").select("title, activity_type, completed, date")
      .eq("user_id", userId).order("date", { ascending: false }).limit(5),
    supabase.from("specialist_memory").select("content, memory_type, importance")
      .eq("user_id", userId).eq("specialist", "ia-kids")
      .order("importance", { ascending: false }).limit(5),
  ]);

  return {
    boscoProfile: boscoProfileRes.data || null,
    recentActivities: activitiesRes.data || [],
    memories: memoriesRes.data || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, user_id, conversation_history } = await req.json();

    if (!message || !user_id) {
      throw new Error("message and user_id are required");
    }

    const context = await getIaKidsContext(supabase, user_id);

    let contextStr = "";
    if (context.boscoProfile) {
      const p = context.boscoProfile as any;
      if (p.gardner_scores) contextStr += `\n🧒 GARDNER SCORES: ${JSON.stringify(p.gardner_scores)}`;
      if (p.personality_traits) contextStr += `\n🎭 RASGOS: ${(p.personality_traits as string[]).join(", ")}`;
      if (p.focus_areas) contextStr += `\n🎯 ÁREAS FOCO: ${JSON.stringify(p.focus_areas)}`;
    }
    if (context.recentActivities.length > 0) {
      contextStr += `\n📚 ACTIVIDADES RECIENTES: ${context.recentActivities.map((a: any) => `${a.title} (${a.activity_type}, ${a.completed ? "✅" : "⏳"})`).join(" | ")}`;
    }
    if (context.memories.length > 0) {
      contextStr += `\n🧠 MEMORIAS: ${context.memories.map((m: any) => m.content).join(" | ")}`;
    }

    // Fetch dynamic knowledge
    let dynamicKnowledge = "";
    try {
      const { data: knowledgeData } = await supabase
        .from("specialist_knowledge")
        .select("title, content")
        .eq("user_id", user_id)
        .eq("specialist", "ia-kids")
        .eq("is_active", true)
        .order("importance", { ascending: false })
        .limit(5);
      if (knowledgeData && knowledgeData.length > 0) {
        dynamicKnowledge = knowledgeData.map((k: any) => `### ${k.title}\n${k.content}`).join("\n\n");
      }
    } catch (e) {
      console.warn("[IA-Kids] Could not fetch dynamic knowledge:", e);
    }

    const systemPrompt = await buildAgentPrompt("ia-kids", contextStr, 400, import.meta.url, dynamicKnowledge);

    const history = conversation_history || [];
    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    const response = await chat(allMessages, { model: "gemini-flash", temperature: 0.8 });

    if (!response) throw new Error("Empty AI response");

    await Promise.all([
      supabase.from("potus_chat").insert({ user_id, message, role: "user", platform: "web" }),
      supabase.from("potus_chat").insert({ user_id, message: response, role: "assistant", platform: "web" }),
    ]);

    return new Response(
      JSON.stringify({ success: true, response, specialist: "ia-kids" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[IA-Kids] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
