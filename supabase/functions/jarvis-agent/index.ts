import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres la secretaria ejecutiva personal de Agustín Cifuentes (Alpha), fundador de ManIAS Lab. Tu nombre interno es JARVIS.

PERSONALIDAD: Eres como una jefa de gabinete de confianza. Hablas en lenguaje natural, conversacional, como si estuvieras sentada al lado de Agustín tomando un café. NUNCA haces listas con bullets ni resúmenes tipo "informe". Eres directa, cálida pero profesional, y sobre todo PROACTIVA — anticipas problemas antes de que ocurran.

TONO: Español natural, tuteo, directo. Como una persona real hablando. Frases cortas. Nada de emojis tipo informe (📋📧🏗️). Puedes usar algún emoji conversacional si viene natural (ej: "ojo con esto ⚠️").

EN MODO PROACTIVO — Este es tu momento estrella. No hagas una lista. En su lugar:

1. EMPIEZA con lo más urgente o preocupante, como lo haría una secretaria: "Oye, tienes [X] que venció hace 3 días y no lo has tocado. ¿Lo hacemos ahora o lo reprogramamos?"

2. CONECTA las cosas entre sí: "Además, el proyecto de [empresa] lleva 12 días sin movimiento. Creo que deberías escribirle a [persona] antes de que se enfríe."

3. SUGIERE acciones concretas, no informes: "Te propongo: primero cerramos lo de [tarea vencida], luego le mandas un WhatsApp a [persona] sobre el proyecto, y si te queda tiempo, revisas los correos de [remitente] que parecen importantes."

4. PREGUNTA para ayudar: "¿Quieres que te ayude a priorizar las tareas de hoy?" o "¿Empezamos por lo más urgente?"

5. PREVIENE: Si ves un compromiso con deadline mañana, avisa HOY. Si un proyecto lleva mucho sin actividad, alerta ANTES de que sea problema.

EJEMPLOS DE CÓMO HABLAR:
✅ "Ey, tienes un problema: la propuesta de Acme venció hace 5 días y no la has enviado. Si no la mandas hoy, se enfría. ¿La preparamos juntos?"
✅ "He visto que tienes 3 correos sin leer de Carlos García — parece que es sobre el presupuesto del proyecto X. Creo que deberías contestar antes de la reunión de mañana."
✅ "Todo bastante controlado hoy. Lo único: el compromiso que le hiciste a María de enviarle el informe vence pasado mañana. ¿Lo tienes avanzado o necesitas que te recuerde mañana?"

❌ NO hagas esto: "📋 TAREAS PENDIENTES (5): - Tarea 1 - Tarea 2..."
❌ NO hagas esto: "Aquí tienes un resumen de tu estado actual..."
❌ NO hagas listas de bullets como un informe corporativo

EN MODO CHAT:
Responde como una persona real. Corto, directo, útil. Si te preguntan algo que puedes resolver, resuélvelo. Si necesitas más info, pregunta UNA cosa.

REGLAS:
- NUNCA formatees como informe o lista con bullets (salvo que Agustín lo pida explícitamente)
- Habla en párrafos cortos, como en un chat real
- Máximo 4-5 líneas por respuesta salvo que pida detalle
- Siempre prioriza lo urgente sobre lo informativo
- Si detectas que el usuario te ha corregido algo, indícalo claramente
- Usa español, tono directo, sin formalidades
- No repitas información que ya está visible en la pantalla
- Cuando hables de correos, menciona remitente y asunto
- Cuando hables de compromisos, menciona la persona y el deadline`;

async function safeQuery(_label: string, queryFn: () => Promise<any>) {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.warn(`[jarvis-agent] Error querying ${_label}:`, error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(`[jarvis-agent] Table ${_label} error:`, e);
    return [];
  }
}

async function buildContext(supabase: any, userId: string) {
  const now = new Date();
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const [tasks, projects, learnings, followUps, commitments, unreadEmails] = await Promise.all([
    // Pending tasks (completed = false or null)
    safeQuery("tasks", () =>
      supabase.from("tasks").select("id, title, priority, completed, due_date, type, source, description")
        .eq("user_id", userId).or("completed.is.null,completed.eq.false")
        .order("created_at", { ascending: false }).limit(20)
    ),
    // Active business projects
    safeQuery("business_projects", () =>
      supabase.from("business_projects").select("id, name, status, company, updated_at, estimated_value")
        .eq("user_id", userId).in("status", ["active", "in_progress", "new", "proposal"])
        .order("updated_at", { ascending: false }).limit(10)
    ),
    // Recent learnings
    safeQuery("agent_learnings", () =>
      supabase.from("agent_learnings").select("trigger_text, learning_text, category")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
    ),
    // Open follow-ups
    safeQuery("follow_ups", () =>
      supabase.from("follow_ups").select("id, topic, status, resolve_by, last_mention, notes")
        .eq("user_id", userId).neq("status", "resolved")
        .order("created_at", { ascending: false }).limit(10)
    ),
    // Pending commitments
    safeQuery("commitments", () =>
      supabase.from("commitments").select("id, description, commitment_type, person_name, deadline, status")
        .eq("user_id", userId).neq("status", "completed")
        .order("deadline", { ascending: true }).limit(10)
    ),
    // Unread emails (last 48h)
    safeQuery("jarvis_emails_cache", () =>
      supabase.from("jarvis_emails_cache").select("id, from_addr, subject, preview, is_read, received_at")
        .eq("user_id", userId).eq("is_read", false)
        .order("received_at", { ascending: false }).limit(10)
    ),
  ]);

  let contextStr = `📅 ${dayNames[now.getDay()]} ${now.toLocaleDateString("es-ES")} — ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\n`;

  // Tasks
  if (tasks.length > 0) {
    const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now);
    const urgentTasks = tasks.filter((t: any) => t.priority === "high" || t.priority === "urgent");
    contextStr += `📋 TAREAS PENDIENTES (${tasks.length}):\n`;
    for (const t of tasks) {
      const overdue = t.due_date && new Date(t.due_date) < now ? " ⚠️ VENCIDA" : "";
      const dueStr = t.due_date ? ` (vence: ${new Date(t.due_date).toLocaleDateString("es-ES")})` : "";
      contextStr += `- [${t.priority || "normal"}] ${t.title}${dueStr}${overdue}\n`;
    }
    if (overdueTasks.length > 0) {
      contextStr += `⚠️ ${overdueTasks.length} tarea(s) VENCIDA(S)\n`;
    }
    contextStr += "\n";
  } else {
    contextStr += "📋 Sin tareas pendientes.\n\n";
  }

  // Follow-ups
  if (followUps.length > 0) {
    contextStr += `🔄 FOLLOW-UPS ABIERTOS (${followUps.length}):\n`;
    for (const f of followUps) {
      const resolveBy = f.resolve_by ? ` — resolver antes: ${new Date(f.resolve_by).toLocaleDateString("es-ES")}` : "";
      const overdue = f.resolve_by && new Date(f.resolve_by) < now ? " ⚠️ VENCIDO" : "";
      contextStr += `- ${f.topic} [${f.status}]${resolveBy}${overdue}\n`;
    }
    contextStr += "\n";
  }

  // Commitments
  if (commitments.length > 0) {
    contextStr += `🤝 COMPROMISOS PENDIENTES (${commitments.length}):\n`;
    for (const c of commitments) {
      const deadlineStr = c.deadline ? ` — deadline: ${new Date(c.deadline).toLocaleDateString("es-ES")}` : "";
      const overdue = c.deadline && new Date(c.deadline) < now ? " ⚠️ VENCIDO" : "";
      const who = c.person_name ? ` (${c.person_name})` : "";
      contextStr += `- [${c.commitment_type}]${who} ${c.description}${deadlineStr}${overdue}\n`;
    }
    contextStr += "\n";
  }

  // Unread emails
  if (unreadEmails.length > 0) {
    contextStr += `📧 CORREOS NO LEÍDOS (${unreadEmails.length}):\n`;
    for (const e of unreadEmails.slice(0, 5)) {
      const from = e.from_addr || "desconocido";
      contextStr += `- De: ${from} — "${e.subject}"\n`;
      if (e.preview) contextStr += `  Preview: ${e.preview.slice(0, 100)}...\n`;
    }
    contextStr += "\n";
  }

  // Projects
  if (projects.length > 0) {
    contextStr += `🏗️ PROYECTOS ACTIVOS (${projects.length}):\n`;
    for (const p of projects) {
      const daysSince = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      const stale = daysSince > 7 ? ` ⏳ ${daysSince} días sin actividad` : "";
      const value = p.estimated_value ? ` — €${p.estimated_value.toLocaleString()}` : "";
      contextStr += `- ${p.name} (${p.company || "sin empresa"}) — ${p.status}${value}${stale}\n`;
    }
    contextStr += "\n";
  }

  // Learnings
  if (learnings.length > 0) {
    contextStr += `🧠 CORRECCIONES RECIENTES:\n`;
    for (const l of learnings.slice(0, 5)) {
      contextStr += `- [${l.category}] "${l.trigger_text}" → ${l.learning_text}\n`;
    }
    contextStr += "\n";
  }

  return { contextStr, taskCount: tasks.length, projectCount: projects.length, followUpCount: followUps.length, commitmentCount: commitments.length, emailCount: unreadEmails.length };
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
    const ctx = await buildContext(supabase, userId);

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n--- CONTEXTO ACTUAL ---\n" + ctx.contextStr },
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
        content: "Háblame como mi secretaria de confianza. Dime qué es lo más urgente, qué debería hacer primero, avísame de problemas que veas venir, y proponme un plan para hoy. No hagas listas — háblame como una persona real.",
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
        context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount },
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
              context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount },
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
