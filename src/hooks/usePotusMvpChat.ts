import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Obtiene contexto del sistema para inyectarlo en cada mensaje
async function buildSystemContext(): Promise<string> {
  const lines: string[] = ["=== CONTEXTO DEL SISTEMA (en tiempo real) ==="];

  try {
    // 1. Estado de nodos desde Supabase cloudbot_nodes
    const { data: nodes } = await supabase
      .from("cloudbot_nodes")
      .select("node_id, status, last_heartbeat, active_workers, current_load, metadata")
      .order("node_id");
    if (nodes?.length) {
      lines.push("\nNODOS ACTIVOS:");
      nodes.forEach(n => {
        const meta = (n.metadata as any) || {};
        lines.push(`- ${n.node_id.toUpperCase()}: ${n.status} | carga ${n.current_load ?? 0}% | workers ${n.active_workers ?? 0} | ${meta.model || ''}`);
      });
    }
  } catch {}

  try {
    // 2. Tareas activas en cloudbot_tasks_log
    const { data: tasks } = await supabase
      .from("cloudbot_tasks_log")
      .select("title, status, assigned_to, priority")
      .in("status", ["pending_approval", "queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(8);
    if (tasks?.length) {
      lines.push("\nTAREAS ACTIVAS EN AGENTES:");
      tasks.forEach(t => lines.push(`- [${t.status}] ${t.title} → ${t.assigned_to || 'sin asignar'}`));
    }
  } catch {}

  try {
    // 3. Tareas de la app del usuario (tasks table)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userTasks } = await supabase
        .from("tasks")
        .select("title, priority, due_date, type, source")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (userTasks?.length) {
        lines.push("\nTAREAS PENDIENTES DEL USUARIO:");
        userTasks.forEach(t => lines.push(`- [${t.priority}] ${t.title}${t.due_date ? ` (vence ${t.due_date})` : ''}`));
      }

      // 4. Proyectos recientes
      const { data: projects } = await supabase
        .from("business_projects")
        .select("name, status, notes")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .limit(6);
      if (projects?.length) {
        lines.push("\nPROYECTOS ACTIVOS:");
        projects.forEach(p => lines.push(`- ${p.name} [${p.status}]${p.notes ? ': ' + p.notes?.slice(0, 80) : ''}`));
      }
    }
  } catch {}

  try {
    // 5. Snapshot de bridge si disponible (estado real de OpenClaw)
    const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
    const snap = await fetch(`${bridgeBase}/api/openclaw/snapshot`, { signal: AbortSignal.timeout(2000) });
    if (snap.ok) {
      const snapData = await snap.json();
      if (snapData.activeSessions) lines.push(`\nSesiones OpenClaw activas: ${snapData.activeSessions}`);
      if (snapData.activeAgents) lines.push(`Agentes OpenClaw activos: ${snapData.activeAgents}`);
      if (snapData.liveLog?.length) {
        lines.push("Último log del gateway:");
        snapData.liveLog.slice(-3).forEach((l: any) => lines.push(`  ${l.agent}: ${l.action}`));
      }
    }
  } catch {}

  lines.push("\n=== FIN CONTEXTO ===");
  return lines.join("\n");
}

export type PotusChatRole = "user" | "assistant";
export type PotusChatStatus = "idle" | "sending" | "error";

export interface PotusChatMessage {
  id: string;
  role: PotusChatRole;
  content: string;
  createdAt: string;
}

const createMessage = (role: PotusChatRole, content: string): PotusChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
});

export function usePotusMvpChat() {
  const [messages, setMessages] = useState<PotusChatMessage[]>([]);
  const [status, setStatus] = useState<PotusChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationKey, setConversationKey] = useState<string | null>(null);
  const [surfaces, setSurfaces] = useState<string[]>(["app"]);
  const [lastResponseData, setLastResponseData] = useState<Record<string, unknown> | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    const content = input.trim();
    if (!content || status === "sending") return;

    const nextUserMessage = createMessage("user", content);
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setStatus("sending");
    setError(null);

    try {
      // Construir contexto en tiempo real para inyectar al asistente
      const systemContext = await buildSystemContext();
      const payloadMessages = nextMessages.slice(-10).map(({ role, content }) => ({ role, content }));
      let data: any = null;
      const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
      // Intento bridge con timeout corto (2s) — si no responde, va directo a potus-core
      try {
        const bridgeRes = await fetch(`${bridgeBase}/api/potus/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, messages: payloadMessages }),
          signal: AbortSignal.timeout(2000),
        });
        if (bridgeRes.ok) {
          const bridgeData = await bridgeRes.json();
          // Solo usar bridge si devuelve respuesta real de IA (no el stub)
          if (bridgeData.source === "potus-core") { data = bridgeData; }
        }
      } catch { /* bridge no disponible — OK, usamos potus-core */ }

      if (!data) {
        const fallback = await supabase.functions.invoke("potus-core", {
          body: {
            action: "chat",
            message: `${systemContext}\n\nMENSAJE DEL USUARIO: ${content}`,
            messages: payloadMessages,
            platform: "app",
          },
        });
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }

      const reply = data?.message || data?.response || "Sin respuesta";

      setMessages((current) => [...current, createMessage("assistant", reply)]);
      setLastResponseData(data || null);
      setConversationKey(data?.conversationKey || null);
      setSurfaces(Array.isArray(data?.surfaces) && data.surfaces.length > 0 ? data.surfaces : ["app"]);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar la petición";
      setStatus("error");
      setError(message);
      setMessages((current) => [
        ...current,
        createMessage("assistant", "No he podido responder ahora mismo. Reintenta en unos segundos."),
      ]);
    }
  }, [messages, status]);

  const reset = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setError(null);
    setConversationKey(null);
    setSurfaces(["app"]);
    setLastResponseData(null);
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "sending") return "respondiendo";
    if (status === "error") return "error";
    return messages.length > 0 ? "listo" : "sin iniciar";
  }, [messages.length, status]);

  return {
    messages,
    status,
    statusLabel,
    error,
    conversationKey,
    surfaces,
    lastResponseData,
    sendMessage,
    reset,
  };
}
