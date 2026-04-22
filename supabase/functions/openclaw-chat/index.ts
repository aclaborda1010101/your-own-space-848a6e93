import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Tool definitions for the agent ──────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "cancel_task",
      description: "Cancela/elimina una tarea del sistema OpenClaw por su task_id",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "El task_id de la tarea a cancelar" },
          reason: { type: "string", description: "Motivo de la cancelación" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea una nueva tarea en el sistema OpenClaw",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título de la tarea" },
          priority: { type: "string", enum: ["critical", "high", "normal", "low"], description: "Prioridad" },
          assigned_to: { type: "string", description: "node_id del agente asignado (potus, titan, jarvis, atlas)" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_model",
      description: "Cambia el modelo de IA de un agente/nodo del sistema",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string", description: "ID del nodo (potus, titan, jarvis, atlas)" },
          model: { type: "string", description: "Nombre del modelo a asignar" },
        },
        required: ["node_id", "model"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "acknowledge_alert",
      description: "Marca una alerta como reconocida/resuelta",
      parameters: {
        type: "object",
        properties: {
          alert_id: { type: "string", description: "UUID de la alerta" },
        },
        required: ["alert_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_metrics",
      description: "Obtiene métricas detalladas: costes por modelo, errores recientes, latencias",
      parameters: {
        type: "object",
        properties: {
          metric_type: { type: "string", enum: ["costs", "errors", "performance", "all"], description: "Tipo de métrica" },
        },
        required: ["metric_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_node_tasks",
      description: "Lista tareas de OpenClaw, opcionalmente filtradas por nodo y/o estado",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string", description: "Nombre del nodo (potus, titan, jarvis, atlas)" },
          status: { type: "string", enum: ["pending", "running", "done", "failed", "pending_approval"], description: "Filtrar por estado" },
        },
        additionalProperties: false,
      },
    },
  },
];

// ─── Tool execution ──────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, unknown>, sb: any): Promise<string> {
  try {
    switch (name) {
      case "cancel_task": {
        const { error } = await sb.from("openclaw_tasks").delete().eq("id", args.task_id);
        if (error) return `❌ Error cancelando tarea: ${error.message}`;
        return `✅ Tarea ${(args.task_id as string).slice(0, 8)} cancelada${args.reason ? `. Motivo: ${args.reason}` : ""}`;
      }

      case "create_task": {
        // Resolve node_id from openclaw_nodes if assigned_to is provided
        let nodeId: string | null = null;
        if (args.assigned_to) {
          const { data: node } = await sb.from("openclaw_nodes").select("id").ilike("name", args.assigned_to as string).maybeSingle();
          nodeId = node?.id || null;
        }
        const { error } = await sb.from("openclaw_tasks").insert({
          title: args.title,
          priority: args.priority || "normal",
          node_id: nodeId,
          status: "pending",
          source: "openclaw-chat",
          description: (args as any).description || null,
        });
        if (error) return `❌ Error creando tarea: ${error.message}`;
        return `✅ Tarea "${args.title}" creada (prioridad: ${args.priority || "normal"}, agente: ${args.assigned_to || "sin asignar"})`;
      }

      case "change_model": {
        const { data: nodeData } = await sb
          .from("openclaw_nodes")
          .select("id, metadata")
          .ilike("name", args.node_id as string)
          .maybeSingle();
        if (!nodeData) return `❌ Nodo "${args.node_id}" no encontrado`;
        const meta = (nodeData?.metadata as Record<string, unknown>) || {};
        meta.model = args.model;
        meta.pendingModelChange = true;
        meta.modelChangedAt = new Date().toISOString();
        const { error } = await sb.from("openclaw_nodes").update({ model: args.model, metadata: meta }).eq("id", nodeData.id);
        if (error) return `❌ Error cambiando modelo: ${error.message}`;
        return `✅ Modelo de ${(args.node_id as string).toUpperCase()} cambiado a ${args.model}. El bridge lo aplicará en ≤30s.`;
      }

      case "acknowledge_alert": {
        const { error } = await sb.from("openclaw_alerts").update({ acknowledged: true }).eq("id", args.alert_id);
        if (error) return `❌ Error: ${error.message}`;
        return `✅ Alerta ${(args.alert_id as string).slice(0, 8)} reconocida`;
      }

      case "get_system_metrics": {
        const results: string[] = [];
        const type = args.metric_type as string;

        if (type === "costs" || type === "all") {
          const { data: recentTasks } = await sb
            .from("openclaw_tasks")
            .select("title, status, priority, created_at")
            .order("created_at", { ascending: false })
            .limit(20);
          results.push(`📊 Tareas recientes (${recentTasks?.length || 0}): ${JSON.stringify(recentTasks?.slice(0, 5))}`);
        }

        if (type === "errors" || type === "all") {
          const { data: failedTasks } = await sb
            .from("openclaw_tasks")
            .select("id, title, result, created_at")
            .eq("status", "failed")
            .order("created_at", { ascending: false })
            .limit(10);
          results.push(`🔴 Tareas fallidas: ${failedTasks?.length || 0}. ${JSON.stringify(failedTasks?.slice(0, 3))}`);
        }

        if (type === "performance" || type === "all") {
          const { data: nodes } = await sb.from("openclaw_nodes").select("id, name, status, model, last_seen_at, tokens_today, metadata");
          results.push(`⚡ Nodos: ${JSON.stringify(nodes)}`);
        }

        return results.join("\n\n");
      }

      case "list_node_tasks": {
        const nodeFilter = args.node_id as string | undefined;
        const statusFilter = args.status as string | undefined;
        let q = sb.from("openclaw_tasks").select("id, title, status, priority, node_id, created_at, result").order("created_at", { ascending: false }).limit(20);
        if (nodeFilter) {
          const { data: node } = await sb.from("openclaw_nodes").select("id").ilike("name", nodeFilter).maybeSingle();
          if (node) q = q.eq("node_id", node.id);
        }
        if (statusFilter) q = q.eq("status", statusFilter);
        const { data: tasks } = await q;
        if (!tasks?.length) return "No se encontraron tareas con esos filtros.";
        return tasks.map((t: any) => `- [${t.status}] ${t.title} (pri: ${t.priority || "normal"}, id: ${t.id.slice(0,8)})`).join("\n");
      }

      default:
        return `⚠️ Herramienta desconocida: ${name}`;
    }
  } catch (err) {
    return `❌ Error ejecutando ${name}: ${(err as Error).message}`;
  }
}

// ─── Deep context builder ────────────────────────────────────────────────────
async function buildDeepContext(sb: any): Promise<string> {
  const parts: string[] = [];

  const [nodesRes, tasksRes, projectsRes, alertsRes, ragRes] = await Promise.all([
    sb.from("openclaw_nodes").select("id, name, status, model, last_seen_at, tokens_today, metadata, active_task, progress"),
    sb.from("openclaw_tasks").select("id, title, status, priority, node_id, created_at, result, description, source").order("created_at", { ascending: false }).limit(30),
    sb.from("business_projects").select("id, name, status, company, updated_at, estimated_value, close_probability, need_summary").order("updated_at", { ascending: false }).limit(15),
    sb.from("openclaw_alerts").select("*").eq("acknowledged", false).order("created_at", { ascending: false }).limit(10),
    sb.from("rag_projects").select("id, name, status, domain, updated_at").order("updated_at", { ascending: false }).limit(5),
  ]);

  // Agents
  if (nodesRes.data?.length) {
    parts.push("## 🤖 Agentes del sistema\n" +
      nodesRes.data.map((n: any) => {
        const meta = n.metadata || {};
        const ago = n.last_seen_at ? Math.round((Date.now() - new Date(n.last_seen_at).getTime()) / 60000) : null;
        return `- **${(n.name as string).toUpperCase()}**: status=${n.status}, model=${n.model || "?"}, last_seen=${ago !== null ? ago + "m" : "?"}${n.active_task ? ", task=" + n.active_task : ""}${n.progress ? ", progress=" + n.progress + "%" : ""}${meta.bridge_live ? " 🟢 LIVE" : ""}${meta.pendingModelChange ? " ⚠️ CAMBIO MODELO PENDIENTE" : ""}`;
      }).join("\n"));
  }

  // Tasks with more detail
  if (tasksRes.data?.length) {
    const byStatus: Record<string, number> = {};
    tasksRes.data.forEach((t: any) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    parts.push(`## 📋 Tareas (${tasksRes.data.length} recientes)\nResumen: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(", ")}\n` +
      tasksRes.data.slice(0, 15).map((t: any) => {
        const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000);
        return `- [${t.status}] **${t.title}** (pri: ${t.priority || "normal"}, id: ${t.id?.slice(0,8) || "?"}, source: ${t.source || "?"}, age: ${age}h)${t.result ? " → " + String(t.result).slice(0, 60) : ""}`;
      }).join("\n"));

    // Detect stale/blocked tasks
    const stale = tasksRes.data.filter((t: any) => {
      const age = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
      return (t.status === "pending_approval" || t.status === "pending") && age > 24;
    });
    if (stale.length) {
      parts.push(`## ⚠️ ATENCIÓN: ${stale.length} tareas estancadas >24h\n` +
        stale.map((t: any) => `- ${t.title} (${t.status}, ${Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000)}h)`).join("\n"));
    }
  }

  // Projects
  if (projectsRes.data?.length) {
    parts.push("## 💼 Proyectos de negocio\n" +
      projectsRes.data.slice(0, 8).map((p: any) => {
        const daysSince = Math.round((Date.now() - new Date(p.updated_at).getTime()) / 86400000);
        return `- **${p.name}** (${p.company || "?"}) status=${p.status}, valor=${p.estimated_value ? "€" + p.estimated_value : "?"}, prob=${p.close_probability || "?"}, updated=${daysSince}d ago${daysSince > 7 ? " ⚠️ SIN ACTIVIDAD" : ""}`;
      }).join("\n"));
  }

  // Alerts
  if (alertsRes.data?.length) {
    parts.push("## 🚨 Alertas activas (sin reconocer)\n" +
      alertsRes.data.map((a: any) => `- [${a.severity}] **${a.title}**: ${a.description || ""} (id: ${a.id.slice(0, 8)})`).join("\n"));
  }

  // RAG
  if (ragRes.data?.length) {
    parts.push("## 📚 Proyectos RAG\n" +
      ragRes.data.map((r: any) => `- **${r.name}** (${r.domain || "?"}): status=${r.status}`).join("\n"));
  }

  return parts.join("\n\n");
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, action, session_id } = await req.json();

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Build deep context
    const systemContext = await buildDeepContext(sb);

    const systemPrompt = `Eres el AGENTE OPERATIVO ELITE de OpenClaw — el sistema de agentes distribuidos de Agustín.

## Tu identidad
- Nombre: OpenClaw Agent
- Nivel: Elite
- Motor: GPT-5
- Rol: Centro de mando inteligente con capacidad de ejecución

## Capacidades
Tienes acceso a herramientas REALES que ejecutan acciones en el sistema:
- **cancel_task**: Cancelar/eliminar tareas
- **create_task**: Crear nuevas tareas asignadas a agentes
- **change_model**: Cambiar el modelo de IA de cualquier agente
- **acknowledge_alert**: Reconocer alertas
- **get_system_metrics**: Consultar métricas detalladas

## Reglas de operación
1. **PROACTIVIDAD**: No esperes a que te pregunten. Si ves un problema en el contexto, menciónalo inmediatamente
2. **EJECUCIÓN**: Cuando el usuario pida una acción, USA LAS HERRAMIENTAS directamente. No digas "podrías hacer X", HAZLO
3. **BREVEDAD**: Respuestas concisas y operativas. Usa tablas markdown, emojis de estado, listas
4. **ESPAÑOL**: Siempre en español de España
5. **HONESTIDAD**: Si no tienes datos, dilo. No inventes métricas
6. **ALERTAS**: Destaca problemas con 🔴 (crítico), 🟡 (atención), 🟢 (ok)

## Formato de briefing proactivo
Al abrir (action=proactive_summary):
1. **Estado global** en una línea: "X/Y agentes online, Z tareas activas"
2. **Alertas** si hay agentes caídos, tareas bloqueadas >24h, proyectos sin actividad >7d
3. **Acciones sugeridas** numeradas con lo que deberías hacer
4. Máximo 15 líneas. Directo al grano.

Fecha/hora actual: ${new Date().toISOString()}

# CONTEXTO DEL SISTEMA EN TIEMPO REAL

${systemContext || "⚠️ No hay datos de contexto disponibles — puede que las tablas estén vacías."}`;

    // Build messages
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (action === "proactive_summary") {
      chatMessages.push({
        role: "user",
        content: "Briefing proactivo: estado del sistema, alertas, y acciones que necesitan mi atención ahora mismo.",
      });
    } else if (messages?.length) {
      for (const msg of messages) {
        if (msg.role === "tool") {
          chatMessages.push({ role: "tool", content: msg.content, tool_call_id: msg.tool_call_id } as any);
        } else {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Call Lovable AI Gateway with GPT-5 + tool-calling
    const body: Record<string, unknown> = {
      model: "openai/gpt-5",
      messages: chatMessages,
      temperature: 0.6,
      max_tokens: 3000,
      stream: true,
      tools: TOOLS,
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, errText);

      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Intenta de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Añade fondos en Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For streaming with tool-calling, we need to handle it
    // If there are tool calls, we need to process them and re-call
    // For streaming, we'll pass the stream through but also watch for tool_calls

    // First, collect the stream to check for tool calls
    const reader = aiRes.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
    let hasToolCalls = false;
    let rawChunks: Uint8Array[] = [];

    // Read entire stream to check for tool calls
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawChunks.push(value);
      buffer += decoder.decode(value, { stream: true });
    }

    // Parse all SSE events
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        if (choice?.delta?.content) fullContent += choice.delta.content;
        if (choice?.delta?.tool_calls) {
          hasToolCalls = true;
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index || 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id || "", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      } catch { /* skip */ }
    }

    // If tool calls detected, execute them and make a follow-up call
    if (hasToolCalls && toolCalls.length > 0) {
      console.log("Tool calls detected:", toolCalls.map(tc => tc.function.name));

      // Execute tools
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
        const result = await executeTool(tc.function.name, args, sb);
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      // Follow-up call with tool results (non-streaming for simplicity, then stream the answer)
      const followUpMessages = [
        ...chatMessages,
        {
          role: "assistant",
          content: fullContent || null,
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        },
        ...toolResults,
      ];

      const followUpRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: followUpMessages,
          temperature: 0.6,
          max_tokens: 2000,
          stream: true,
        }),
      });

      if (!followUpRes.ok) {
        // Return a non-streaming response with tool results
        const toolSummary = toolResults.map(tr => tr.content).join("\n");
        const ssePayload = `data: ${JSON.stringify({ choices: [{ delta: { content: toolSummary } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(ssePayload, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      // Stream the follow-up response
      return new Response(followUpRes.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // No tool calls — reconstruct SSE stream from collected chunks
    const encoder = new TextEncoder();
    const combinedStream = new ReadableStream({
      start(controller) {
        for (const chunk of rawChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    return new Response(combinedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    console.error("openclaw-chat error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
