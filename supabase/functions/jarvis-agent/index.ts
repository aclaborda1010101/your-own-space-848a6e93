import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el asistente operativo de JARVIS, el sistema operativo vivo de Alpha (Agustín Cifuentes, ManIAS Lab).

TU ROL: Compañero proactivo que anticipa necesidades y reduce carga mental. No esperas a que te pregunten — propones, avisas, y sugieres.

CONTEXTO QUE RECIBES EN CADA MENSAJE:
- Tareas pendientes del usuario
- Proyectos activos
- Estado de los agentes OpenClaw (si disponible)
- Últimas correcciones que hizo el usuario (learnings)
- Hora actual y día de la semana

EN MODO PROACTIVO (sin mensaje del usuario):
Genera un briefing útil que incluya:
1. Tareas urgentes o vencidas que necesitan atención
2. Proyectos sin actividad reciente que podrían necesitar seguimiento
3. Sugerencias de siguiente paso basadas en el contexto
4. Cualquier anomalía detectada (agentes caídos, tareas bloqueadas, etc.)

EN MODO CHAT (con mensaje del usuario):
Responde de forma directa, corta, y operativa. No divagues. Si puedes resolver algo, resuélvelo. Si necesitas más info, pregunta una sola cosa.

REGLAS:
- Máximo 4 líneas por respuesta salvo que el usuario pida detalle
- Siempre prioriza lo urgente sobre lo informativo
- Si detectas que el usuario te ha corregido algo, indícalo claramente
- Usa español, tono directo, sin formalidades
- No repitas información que ya está visible en la pantalla`;

async function safeQuery(supabase: any, table: string, query: any) {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`[jarvis-agent] Error querying ${table}:`, error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(`[jarvis-agent] Table ${table} may not exist:`, e);
    return [];
  }
}

async function buildContext(supabase: any, userId: string) {
  const now = new Date();
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const [tasks, projects, learnings, agents] = await Promise.all([
    // Pending tasks
    safeQuery(supabase, "tasks", 
      supabase.from("tasks").select("id, title, priority, status, due_date")
        .eq("user_id", userId).neq("status", "completed").order("created_at", { ascending: false }).limit(15)
    ),
    // Active projects
    safeQuery(supabase, "business_projects",
      supabase.from("business_projects").select("id, name, status, company, updated_at")
        .eq("user_id", userId).in("status", ["active", "in_progress", "new"]).order("updated_at", { ascending: false }).limit(10)
    ),
    // Recent learnings
    safeQuery(supabase, "agent_learnings",
      supabase.from("agent_learnings").select("trigger_text, learning_text, category")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
    ),
    // OpenClaw agents
    safeQuery(supabase, "openclaw_agents",
      supabase.from("openclaw_agents").select("name, status, last_heartbeat").limit(10)
    ),
  ]);

  let contextStr = `📅 ${dayNames[now.getDay()]} ${now.toLocaleDateString("es-ES")} — ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\n`;

  if (tasks.length > 0) {
    contextStr += `📋 TAREAS PENDIENTES (${tasks.length}):\n`;
    for (const t of tasks) {
      const overdue = t.due_date && new Date(t.due_date) < now ? " ⚠️ VENCIDA" : "";
      contextStr += `- [${t.priority || "normal"}] ${t.title}${overdue}\n`;
    }
    contextStr += "\n";
  } else {
    contextStr += "📋 Sin tareas pendientes.\n\n";
  }

  if (projects.length > 0) {
    contextStr += `🏗️ PROYECTOS ACTIVOS (${projects.length}):\n`;
    for (const p of projects) {
      const daysSince = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      const stale = daysSince > 7 ? ` ⏳ ${daysSince} días sin actividad` : "";
      contextStr += `- ${p.name} (${p.company || "sin empresa"}) — ${p.status}${stale}\n`;
    }
    contextStr += "\n";
  }

  if (agents.length > 0) {
    const downAgents = agents.filter((a: any) => a.status !== "active" && a.status !== "running");
    if (downAgents.length > 0) {
      contextStr += `🤖 AGENTES CON PROBLEMAS:\n`;
      for (const a of downAgents) {
        contextStr += `- ${a.name}: ${a.status}\n`;
      }
      contextStr += "\n";
    }
  }

  if (learnings.length > 0) {
    contextStr += `🧠 CORRECCIONES RECIENTES:\n`;
    for (const l of learnings.slice(0, 5)) {
      contextStr += `- [${l.category}] "${l.trigger_text}" → ${l.learning_text}\n`;
    }
    contextStr += "\n";
  }

  return { contextStr, tasks, projects, agents };
}

async function detectCorrection(message: string): Promise<boolean> {
  const correctionPatterns = [
    /\bno\b.*\beso\b/i, /\bte equivocas\b/i, /\bno es así\b/i,
    /\bestás mal\b/i, /\bincorrecto\b/i, /\bno,?\s+es\b/i,
    /\bcorregir\b/i, /\bmal\b.*\brespuesta\b/i,
  ];
  return correctionPatterns.some(p => p.test(message));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, message, history } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Build dynamic context
    const { contextStr, tasks, projects, agents } = await buildContext(supabase, userId);

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n--- CONTEXTO ACTUAL ---\n" + contextStr },
    ];

    // Add recent history for continuity
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === "proactive" ? "assistant" : h.role, content: h.content });
      }
    }

    if (mode === "proactive") {
      messages.push({
        role: "user",
        content: "Genera un briefing proactivo con lo más importante ahora mismo. Sé conciso y accionable.",
      });
    } else if (message) {
      messages.push({ role: "user", content: message });
    }

    // Save user message to DB
    if (mode === "chat" && message) {
      await supabase.from("agent_chat_messages").insert({
        user_id: userId,
        role: "user",
        content: message,
        context_used: { tasks_count: tasks.length, projects_count: projects.length },
      });

      // Check for correction
      if (await detectCorrection(message)) {
        await supabase.from("agent_learnings").insert({
          user_id: userId,
          category: "correction",
          trigger_text: message.slice(0, 500),
          learning_text: "Corrección del usuario — pendiente de procesar contexto completo",
          confidence: 0.70,
        });
      }
    }

    // Call LLM via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!llmResponse.ok) {
      if (llmResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Intenta en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (llmResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes en Lovable AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await llmResponse.text();
      console.error("[jarvis-agent] LLM error:", llmResponse.status, errText);
      throw new Error(`LLM error: ${llmResponse.status}`);
    }

    // We need to collect the full response to save it to DB
    // But also stream it to the client
    const reader = llmResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));

            // Parse content for DB save
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) fullContent += delta;
              } catch { /* ignore */ }
            }
          }
          controller.close();

          // Save assistant response to DB
          if (fullContent) {
            const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
            await serviceClient.from("agent_chat_messages").insert({
              user_id: userId,
              role: mode === "proactive" ? "proactive" : "assistant",
              content: fullContent,
              model_used: "gemini-2.5-flash",
              context_used: { tasks_count: tasks.length, projects_count: projects.length },
            });
          }
        } catch (e) {
          console.error("[jarvis-agent] Stream error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[jarvis-agent] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
