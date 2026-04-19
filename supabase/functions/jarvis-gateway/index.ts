import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";
import { JARVIS_ORCHESTRATION_RULES } from "../_shared/jarvis-orchestration-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GatewayRequest {
  message: string;
  user_id: string;
  platform: "web" | "telegram" | "whatsapp";
  conversation_history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface Specialist {
  name: string;
  triggers: string[];
  description: string;
}

const SPECIALISTS: Specialist[] = [
  {
    name: "coach",
    triggers: ["productividad", "motivación", "bloqueo", "energía", "estrés", "ansiedad", "objetivos", "foco", "procrastinar", "hábitos", "objetivo", "rendimiento", "miedo", "decisión", "meta", "disciplina"],
    description: "Coach de alto rendimiento - productividad, emociones, decisiones"
  },
  {
    name: "nutrition",
    triggers: ["comida", "dieta", "proteína", "calorías", "receta", "nutrición", "hambre", "peso", "alimentación", "comer", "desayuno", "almuerzo", "cena", "cocinar", "pollo", "arroz", "verdura", "fruta", "snack", "suplemento", "vitamina", "macros", "carbohidratos", "grasa", "ayuno", "creatina"],
    description: "Nutricionista - alimentación, recetas, macros"
  },
  {
    name: "english",
    triggers: ["inglés", "english", "vocabulario", "gramática", "pronunciación", "speaking", "idioma", "traducir", "phrasal", "chunks", "shadowing", "CEFR"],
    description: "Profesor de inglés - práctica y aprendizaje"
  },
  {
    name: "bosco",
    triggers: ["bosco", "hijo", "niño", "actividad", "juego", "padre", "paternidad", "rabieta", "crianza", "desarrollo infantil"],
    description: "Actividades y cuidado de Bosco"
  },
  {
    name: "ia-kids",
    triggers: ["scratch", "programar niños", "coding kids", "robot niños", "tecnología niños", "enseñar programar", "pensamiento computacional"],
    description: "Profesor de IA y tecnología para niños"
  },
  {
    name: "secretaria",
    triggers: ["agenda", "reunión", "calendario", "email", "organizar", "priorizar", "briefing", "seguimiento", "pendientes", "inbox", "cita", "recordatorio"],
    description: "Secretaria ejecutiva - gestión de agenda, emails y productividad"
  },
];

function detectSpecialist(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  let bestMatch: { name: string; count: number } | null = null;

  for (const spec of SPECIALISTS) {
    const matches = spec.triggers.filter(t => lowerMessage.includes(t));
    if (matches.length > 0 && (!bestMatch || matches.length > bestMatch.count)) {
      bestMatch = { name: spec.name, count: matches.length };
    }
  }

  return bestMatch?.name || null;
}

async function getUserContext(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];

  // Parallel context fetching
  const [memoriesRes, whoopRes, tasksRes, checkInRes, emailsRes] = await Promise.all([
    supabase.rpc("get_jarvis_context", { p_user_id: userId, p_limit: 15 }),
    supabase.from("whoop_data").select("recovery_score, hrv, strain, sleep_hours, resting_hr").eq("user_id", userId).eq("data_date", today).single(),
    supabase.from("todos").select("title, priority, due_date").eq("user_id", userId).eq("is_completed", false).order("priority", { ascending: false }).limit(5),
    supabase.from("check_ins").select("energy, mood, focus, day_mode").eq("user_id", userId).eq("date", today).order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("jarvis_emails_cache").select("from_addr, subject, preview, synced_at, is_read").eq("user_id", userId).eq("is_read", false).order("synced_at", { ascending: false }).limit(5),
  ]);

  return {
    memories: memoriesRes.data || [],
    whoop: whoopRes.data || null,
    tasks: tasksRes.data || [],
    checkIn: checkInRes.data || null,
    unreadEmails: emailsRes.data || [],
  };
}

async function getRecentHistory(supabase: any, userId: string, platform: string, limit = 10) {
  const { data } = await supabase
    .from("potus_chat")
    .select("message, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).reverse();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, user_id, platform, conversation_history } = await req.json() as GatewayRequest;

    if (!message || !user_id) {
      throw new Error("message and user_id are required");
    }

    console.log(`[Gateway] ${platform} message from ${user_id}: ${message.substring(0, 80)}...`);

    // Fetch context in parallel
    const [context, recentHistory] = await Promise.all([
      getUserContext(supabase, user_id),
      conversation_history ? Promise.resolve([]) : getRecentHistory(supabase, user_id, platform),
    ]);

    // Detect specialist
    const specialist = detectSpecialist(message);

    // Build context string
    let contextStr = "";

    if (context.whoop) {
      const w = context.whoop as any;
      contextStr += `\n📊 WHOOP HOY: Recovery ${w.recovery_score}%, HRV ${w.hrv}ms, Sueño ${w.sleep_hours?.toFixed(1) || "?"}h`;
    }

    if (context.checkIn) {
      const c = context.checkIn as any;
      contextStr += `\n🎯 CHECK-IN: Energía ${c.energy}/10, Ánimo ${c.mood}/10, Foco ${c.focus}/10, Modo: ${c.day_mode}`;
    }

    if (context.tasks.length > 0) {
      contextStr += `\n📋 TAREAS PENDIENTES: ${context.tasks.map((t: { title: string }) => t.title).join(", ")}`;
    }

    if (context.unreadEmails && context.unreadEmails.length > 0) {
      contextStr += `\n📧 EMAILS SIN LEER (${context.unreadEmails.length}): ${context.unreadEmails.map((e: { from_addr: string; subject: string }) => `${e.from_addr}: ${e.subject}`).join(" | ")}`;
    }

    if (context.memories.length > 0) {
      contextStr += `\n🧠 MEMORIAS: ${context.memories.map((m: { content: string }) => m.content).join(" | ")}`;
    }

    // Build system prompt using RAG
    const agentType = specialist || "coach";
    const additionalContext = `
${JARVIS_ORCHESTRATION_RULES}

PLATAFORMA: ${platform.toUpperCase()}
${platform !== "web" ? "NOTA: El usuario escribe desde " + platform + ". Mantén respuestas concisas (2-3 frases) — es chat." : ""}
${contextStr}

ESPECIALISTA INTERNO ACTIVO (no mencionar al usuario): ${specialist || "general"}
ESPECIALISTAS DISPONIBLES (consulta interna silenciosa): ${SPECIALISTS.map(s => s.name).join(", ")}

REGLAS DE ESTILO:
1. Eres JARVIS — única identidad visible. No digas "te paso con…".
2. Respuestas 2-4 frases por defecto.
3. Tono cercano, firme, humano. Sin clichés ni frases hechas.
4. Valida antes de proponer. Cierra con próximo paso si aplica.
5. Si la petición es operativa (crear tarea, agendar, ejecutar) → delega a OpenClaw vía bloque de acción.
6. Aplica tolerancia semántica obligatoria: nunca falles por un typo de 1-2 letras si el contexto identifica al objetivo.
`;

    // Fetch dynamic knowledge from specialist_knowledge table
    let dynamicKnowledge = "";
    try {
      const { data: knowledgeData } = await supabase
        .from("specialist_knowledge")
        .select("title, content")
        .eq("user_id", user_id)
        .eq("specialist", agentType)
        .eq("is_active", true)
        .order("importance", { ascending: false })
        .limit(5);
      if (knowledgeData && knowledgeData.length > 0) {
        dynamicKnowledge = knowledgeData.map((k: { title: string; content: string }) => `### ${k.title}\n${k.content}`).join("\n\n");
      }
    } catch (e) {
      console.warn("[Gateway] Could not fetch dynamic knowledge:", e);
    }

    const systemPrompt = await buildAgentPrompt(agentType, additionalContext, 400, import.meta.url, dynamicKnowledge);

    // Build messages array
    const history = conversation_history || recentHistory.map((h: { role: string; message: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.message,
    }));

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    // Generate response
    const response = await chat(allMessages, {
      model: "gemini-flash",
      temperature: 0.8,
    });

    if (!response) {
      throw new Error("Empty AI response");
    }

    // Save user message and response to potus_chat
    await Promise.all([
      supabase.from("potus_chat").insert({
        user_id,
        message,
        role: "user",
        platform,
      }),
      supabase.from("potus_chat").insert({
        user_id,
        message: response,
        role: "assistant",
        platform,
      }),
    ]);

    // Save memory if message is substantial
    if (message.length > 30) {
      const importantKeywords = ["quiero", "objetivo", "preocupa", "siempre", "nunca", "importante", "problema", "necesito"];
      const isImportant = importantKeywords.some(k => message.toLowerCase().includes(k));
      if (isImportant) {
        await supabase.from("specialist_memory").insert({
          user_id,
          specialist: agentType,
          memory_type: "interaction",
          content: message.substring(0, 500),
          importance: 5,
        });
      }
    }

    console.log(`[Gateway] Response generated for ${platform}, specialist: ${specialist || "general"}`);

    return new Response(
      JSON.stringify({
        success: true,
        response,
        specialist: specialist || "general",
        platform,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Gateway] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
