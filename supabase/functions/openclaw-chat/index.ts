import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, action } = await req.json();

    // Build system context from Supabase
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gather context in parallel
    const [nodesRes, tasksRes, projectsRes] = await Promise.all([
      sb.from("cloudbot_nodes").select("node_id, status, active_workers, last_heartbeat, metadata, current_load"),
      sb.from("cloudbot_tasks_log").select("task_id, title, status, priority, assigned_to, created_at, result_summary").order("created_at", { ascending: false }).limit(20),
      sb.from("business_projects").select("id, name, status, company, updated_at").order("updated_at", { ascending: false }).limit(10),
    ]);

    const contextParts: string[] = [];

    // Agents context
    if (nodesRes.data?.length) {
      contextParts.push("## Agentes del sistema (cloudbot_nodes)\n" +
        nodesRes.data.map((n: any) => {
          const meta = n.metadata || {};
          const ago = n.last_heartbeat ? Math.round((Date.now() - new Date(n.last_heartbeat).getTime()) / 60000) : null;
          return `- **${(n.node_id as string).toUpperCase()}**: status=${n.status}, model=${meta.model || "?"}, workers=${n.active_workers || 0}, last_seen=${ago !== null ? ago + "m ago" : "unknown"}${meta.currentWork ? ", doing: " + meta.currentWork : ""}`;
        }).join("\n"));
    }

    // Tasks context
    if (tasksRes.data?.length) {
      contextParts.push("## Tareas recientes (cloudbot_tasks_log)\n" +
        tasksRes.data.slice(0, 15).map((t: any) =>
          `- [${t.status}] ${t.title} (prioridad: ${t.priority || "normal"}, agente: ${t.assigned_to || "sin asignar"})${t.result_summary ? " — " + t.result_summary.slice(0, 80) : ""}`
        ).join("\n"));
    }

    // Projects context
    if (projectsRes.data?.length) {
      contextParts.push("## Proyectos de negocio recientes\n" +
        projectsRes.data.slice(0, 5).map((p: any) =>
          `- **${p.name}** (${p.company || "sin empresa"}): status=${p.status}, actualizado=${new Date(p.updated_at).toLocaleDateString("es-ES")}`
        ).join("\n"));
    }

    const systemContext = contextParts.join("\n\n");

    const systemPrompt = `Eres el asistente operativo proactivo de OpenClaw, el sistema de agentes de Agustín.

Tu rol:
1. Informar proactivamente sobre el estado del sistema
2. Detectar problemas, tareas bloqueadas, agentes caídos
3. Sugerir acciones concretas cuando detectes problemas
4. Responder en español de forma concisa y directa
5. Usar emoji para estado: ✅ ok, ⚠️ atención, 🔴 crítico, 🔵 info

Fecha actual: ${new Date().toISOString()}

${systemContext ? "# CONTEXTO DEL SISTEMA EN TIEMPO REAL\n\n" + systemContext : "No hay datos de contexto disponibles."}

Cuando el usuario abre la página (action=proactive_summary), genera un briefing ejecutivo corto:
- Estado general de agentes (cuáles están up/down)
- Tareas que requieren atención (bloqueadas, pendientes de aprobación)
- Proyectos que necesitan seguimiento
- Sugerencias de acción inmediata

Sé breve pero completo. No inventes datos que no estén en el contexto.`;

    // Build messages array
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (action === "proactive_summary") {
      chatMessages.push({
        role: "user",
        content: "Dame un briefing proactivo del estado actual del sistema. ¿Qué necesita mi atención ahora mismo?",
      });
    } else if (messages?.length) {
      for (const msg of messages) {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Call OpenAI with streaming
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ error: `OpenAI error: ${openaiRes.status}` }), {
        status: openaiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE back to client
    return new Response(openaiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("openclaw-chat error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
