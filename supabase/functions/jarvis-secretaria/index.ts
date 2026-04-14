import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSecretariaContext(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [tasksRes, checkInRes, emailsRes, memoriesRes] = await Promise.all([
    supabase.from("todos").select("title, priority, due_date, is_completed")
      .eq("user_id", userId).eq("is_completed", false)
      .order("priority", { ascending: false }).limit(10),
    supabase.from("check_ins").select("energy, mood, focus, day_mode")
      .eq("user_id", userId).eq("date", today)
      .order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("jarvis_emails_cache").select("from_addr, subject, preview, synced_at, is_read")
      .eq("user_id", userId).eq("is_read", false)
      .order("synced_at", { ascending: false }).limit(10),
    supabase.from("specialist_memory").select("content, memory_type, importance")
      .eq("user_id", userId).eq("specialist", "secretaria")
      .order("importance", { ascending: false }).limit(5),
  ]);

  return {
    tasks: tasksRes.data || [],
    checkIn: checkInRes.data || null,
    unreadEmails: emailsRes.data || [],
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

    const context = await getSecretariaContext(supabase, user_id);

    let contextStr = "";
    if (context.checkIn) {
      const c = context.checkIn as any;
      contextStr += `\n🎯 CHECK-IN HOY: Energía ${c.energy}/10, Ánimo ${c.mood}/10, Foco ${c.focus}/10, Modo: ${c.day_mode}`;
    }
    if (context.tasks.length > 0) {
      contextStr += `\n📋 TAREAS PENDIENTES (${context.tasks.length}): ${context.tasks.map((t: any) => `${t.title} [P${t.priority}${t.due_date ? `, vence ${t.due_date}` : ""}]`).join(" | ")}`;
    }
    if (context.unreadEmails.length > 0) {
      contextStr += `\n📧 EMAILS SIN LEER (${context.unreadEmails.length}): ${context.unreadEmails.map((e: any) => `${e.from_addr}: ${e.subject}`).join(" | ")}`;
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
        .eq("specialist", "secretaria")
        .eq("is_active", true)
        .order("importance", { ascending: false })
        .limit(5);
      if (knowledgeData && knowledgeData.length > 0) {
        dynamicKnowledge = knowledgeData.map((k: any) => `### ${k.title}\n${k.content}`).join("\n\n");
      }
    } catch (e) {
      console.warn("[Secretaria] Could not fetch dynamic knowledge:", e);
    }

    const systemPrompt = await buildAgentPrompt("secretaria", contextStr, 400, import.meta.url, dynamicKnowledge);

    const history = conversation_history || [];
    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    const response = await chat(allMessages, { model: "gemini-flash", temperature: 0.7 });

    if (!response) throw new Error("Empty AI response");

    // Save to chat history
    await Promise.all([
      supabase.from("potus_chat").insert({ user_id, message, role: "user", platform: "web" }),
      supabase.from("potus_chat").insert({ user_id, message: response, role: "assistant", platform: "web" }),
    ]);

    return new Response(
      JSON.stringify({ success: true, response, specialist: "secretaria" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Secretaria] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
