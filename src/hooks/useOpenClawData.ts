import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types matching OpenClaw page
export type StatusTone = "healthy" | "warning" | "critical" | "idle" | "running";

export interface AgentCardData {
  id: string;
  name: string;
  role: string;
  host: string;
  model: string;
  status: StatusTone;
  load: number;
  queue: number;
  lastSeen: string;
  detail?: string;
  lastBackup?: string;
  restoreStatus?: string;
  currentWork?: string;
  lastAction?: string;
  nextAction?: string;
  progressLabel?: string;
  progressPercent?: number;
}

export interface TaskItem {
  id: string;
  title: string;
  owner: string;
  priority: "alta" | "media" | "baja" | "critical" | "high" | "medium" | "low";
  status: "en cola" | "en curso" | "bloqueada" | "lista" | "pending" | "running" | "completed" | "failed" | "pending_approval" | "queued";
  eta: string;
  detail: string;
  createdAt: string;
  scope: string;
  nextStep: string;
  blockedBy?: string;
}

// Map cloudbot_nodes row to AgentCardData
function mapNodeToAgent(node: any): AgentCardData {
  const meta = (node.metadata as any) || {};
  const load = node.current_load as any;
  const lastHb = node.last_heartbeat;
  const seenAgo = lastHb
    ? `${Math.round((Date.now() - new Date(lastHb).getTime()) / 60000)}m ago`
    : "sin datos";

  const statusMap: Record<string, StatusTone> = {
    online: "healthy",
    busy: "running",
    degraded: "warning",
    offline: "critical",
  };

  return {
    id: node.node_id,
    name: (node.node_id as string).toUpperCase(),
    role: meta.role || "Agente",
    host: meta.host || node.node_id,
    model: meta.model || "deepseek-reasoner",
    status: statusMap[node.status] || "idle",
    load: load?.cpu ?? meta.cpu ?? 0,
    queue: node.active_workers ?? 0,
    lastSeen: seenAgo,
    detail: meta.detail,
    currentWork: meta.currentWork,
    lastAction: meta.lastAction,
    nextAction: meta.nextAction,
    progressLabel: meta.progressLabel,
    progressPercent: meta.progressPercent,
  };
}

// Map cloudbot_tasks_log row to TaskItem
function mapTaskRow(row: any): TaskItem {
  const logs = (row.full_logs as any) || {};
  const priorityMap: Record<string, TaskItem["priority"]> = {
    critical: "alta",
    high: "alta",
    medium: "media",
    low: "baja",
    normal: "media",
  };
  const statusMap: Record<string, TaskItem["status"]> = {
    queued: "en cola",
    running: "en curso",
    completed: "lista",
    failed: "bloqueada",
    pending_approval: "bloqueada",
  };

  return {
    id: row.task_id,
    title: row.title,
    owner: row.assigned_to || "Sin asignar",
    priority: priorityMap[row.priority] || row.priority || "media",
    status: statusMap[row.status] || row.status || "en cola",
    eta: logs.eta || "",
    detail: row.result_summary || logs.detail || "",
    createdAt: row.created_at
      ? new Date(row.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "",
    scope: logs.scope || "",
    nextStep: logs.nextStep || "",
    blockedBy: logs.blockedBy,
  };
}

export function useOpenClawData() {
  const [agents, setAgents] = useState<AgentCardData[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const { toast } = useToast();
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, tasksRes] = await Promise.all([
        supabase.from("cloudbot_nodes").select("*"),
        supabase
          .from("cloudbot_tasks_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (!mountedRef.current) return;

      if (nodesRes.data && nodesRes.data.length > 0) {
        setAgents(nodesRes.data.map(mapNodeToAgent));
        setHasRealData(true);
      }

      if (tasksRes.data && tasksRes.data.length > 0) {
        setTasks(tasksRes.data.map(mapTaskRow));
        setHasRealData(true);
      }
    } catch (err) {
      console.error("useOpenClawData fetch error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    const nodesChannel = supabase
      .channel("openclaw-nodes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "cloudbot_nodes" }, (payload) => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          setAgents((prev) => {
            const updated = mapNodeToAgent(payload.new);
            const idx = prev.findIndex((a) => a.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        } else if (payload.eventType === "DELETE") {
          setAgents((prev) => prev.filter((a) => a.id !== (payload.old as any).node_id));
        }
      })
      .subscribe();

    const tasksChannel = supabase
      .channel("openclaw-tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "cloudbot_tasks_log" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setTasks((prev) => [mapTaskRow(payload.new), ...prev].slice(0, 50));
        } else if (payload.eventType === "UPDATE") {
          setTasks((prev) => prev.map((t) => (t.id === (payload.new as any).task_id ? mapTaskRow(payload.new) : t)));
        } else if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as any).task_id));
        }
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [fetchData]);

  // Actions
  const deleteTask = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from("cloudbot_tasks_log").delete().eq("task_id", taskId);
    if (error) {
      toast({ title: "Error eliminando tarea", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarea eliminada", description: `ID ${taskId.slice(0, 8)}` });
    }
  }, [toast]);

  const changeModel = useCallback(async (nodeId: string, model: string) => {
    const { data: nodeData } = await supabase
      .from("cloudbot_nodes")
      .select("metadata")
      .eq("node_id", nodeId)
      .single();

    const meta = (nodeData?.metadata as any) || {};
    meta.model = model;
    meta.pendingModelChange = true;
    meta.modelChangedAt = new Date().toISOString();

    const { error } = await supabase
      .from("cloudbot_nodes")
      .update({ metadata: meta })
      .eq("node_id", nodeId);

    if (error) {
      toast({ title: "Error cambiando modelo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Modelo aplicado", description: `${nodeId.toUpperCase()} → ${model}` });
      setAgents((prev) => prev.map((a) => (a.id === nodeId ? { ...a, model } : a)));
    }
  }, [toast]);

  return { agents, tasks, loading, hasRealData, deleteTask, changeModel, refetch: fetchData };
}
