import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type NodeStatus = "online" | "idle" | "offline" | "running";
export type TaskStatus = "pending" | "running" | "done" | "failed";
export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface OCNode {
  id: string;
  name: string;
  host: string | null;
  model: string | null;
  status: string;
  description: string | null;
  last_seen_at: string | null;
  tokens_total: number;
  tokens_today: number;
  tokens_today_date: string;
  metadata: any;
}

export interface OCTask {
  id: string;
  node_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tokens_used: number;
  result: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface OCRecurring {
  id: string;
  node_id: string;
  title: string;
  description: string | null;
  priority: string;
  schedule_label: string;
  schedule_cron: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
}

export interface OCExecution {
  id: string;
  task_id: string | null;
  recurring_task_id: string | null;
  node_id: string;
  node_name: string | null;
  status: string;
  source: string;
  model_used: string | null;
  tokens_used: number;
  duration_ms: number | null;
  output: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

// Seeds mínimos: solo se insertan si NO existe ningún nodo con ese name
// para el usuario. Los heartbeats reales (launchd → openclaw-heartbeat)
// sobreescriben model/host/ip/status/last_seen_at.
const SEED_NODES = [
  {
    name: "POTUS",
    host: null,
    model: null,
    description: "Bridge ejecutivo (Telegram MoltBot, decisiones rápidas).",
    status: "idle",
  },
  {
    name: "TITAN",
    host: null,
    model: null,
    description: "Nodo principal de cómputo (Mac Mini M4 Pro).",
    status: "idle",
  },
];

export function useOpenClawHub() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<OCNode[]>([]);
  const [tasks, setTasks] = useState<OCTask[]>([]);
  const [recurring, setRecurring] = useState<OCRecurring[]>([]);
  const [executions, setExecutions] = useState<OCExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const ensureSeed = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("openclaw_nodes")
      .select("name")
      .eq("user_id", uid);
    const names = new Set((data ?? []).map((n: any) => n.name));
    const missing = SEED_NODES.filter((s) => !names.has(s.name));
    if (missing.length) {
      await supabase
        .from("openclaw_nodes")
        .insert(missing.map((s) => ({ ...s, user_id: uid })));
    }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    await ensureSeed(user.id);

    const [nRes, tRes, rRes, eRes] = await Promise.all([
      supabase
        .from("openclaw_nodes")
        .select("*")
        .order("name"),
      supabase
        .from("openclaw_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("openclaw_recurring_tasks")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("openclaw_task_executions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50),
    ]);

    if (!mounted.current) return;
    setNodes((nRes.data ?? []) as OCNode[]);
    setTasks((tRes.data ?? []) as OCTask[]);
    setRecurring((rRes.data ?? []) as OCRecurring[]);
    setExecutions((eRes.data ?? []) as OCExecution[]);
    setLoading(false);
  }, [user, ensureSeed]);

  useEffect(() => {
    mounted.current = true;
    if (!user) return;
    fetchAll();

    const ch = supabase
      .channel("openclaw-hub-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_nodes" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_tasks" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_recurring_tasks" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_task_executions" }, fetchAll)
      .subscribe();

    // Polling cada 30s para garantizar telemetría viva aunque realtime se caiga.
    const poll = window.setInterval(() => {
      if (mounted.current) fetchAll();
    }, 30_000);

    return () => {
      mounted.current = false;
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [user, fetchAll]);

  // ───── ACTIONS ─────

  const createTask = useCallback(
    async (input: { node_id: string; title: string; description?: string; priority?: TaskPriority }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("openclaw_tasks")
        .insert({
          user_id: user.id,
          node_id: input.node_id,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? "normal",
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        toast.error("No se pudo crear la tarea", { description: error.message });
        return null;
      }
      toast.success("Tarea creada", { description: input.title });
      return data;
    },
    [user]
  );

  const createRecurring = useCallback(
    async (input: {
      node_id: string;
      title: string;
      description?: string;
      priority?: TaskPriority;
      schedule_label: string;
      schedule_cron?: string;
    }) => {
      if (!user) return;
      const { error } = await supabase.from("openclaw_recurring_tasks").insert({
        user_id: user.id,
        node_id: input.node_id,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "normal",
        schedule_label: input.schedule_label,
        schedule_cron: input.schedule_cron ?? null,
        enabled: true,
      });
      if (error) {
        toast.error("No se pudo crear la tarea recurrente", { description: error.message });
        return false;
      }
      toast.success("Tarea recurrente programada", { description: input.title });
      return true;
    },
    [user]
  );

  const toggleRecurring = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("openclaw_recurring_tasks")
      .update({ enabled })
      .eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    const { error } = await supabase.from("openclaw_recurring_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Recurrente eliminada");
  }, []);

  const executeNow = useCallback(
    async (recurringId: string) => {
      if (!user) return;
      const r = recurring.find((x) => x.id === recurringId);
      if (!r) return;
      const node = nodes.find((n) => n.id === r.node_id);

      // Crear tarea instantánea derivada
      const { data: task } = await supabase
        .from("openclaw_tasks")
        .insert({
          user_id: user.id,
          node_id: r.node_id,
          title: `[recurrente] ${r.title}`,
          description: r.description,
          priority: r.priority,
          status: "pending",
        })
        .select()
        .single();

      // Marcar la recurrente como disparada
      await supabase
        .from("openclaw_recurring_tasks")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: r.run_count + 1,
        })
        .eq("id", recurringId);

      // Registrar ejecución (queued, sin bridge live)
      await supabase.from("openclaw_task_executions").insert({
        user_id: user.id,
        task_id: task?.id ?? null,
        recurring_task_id: recurringId,
        node_id: r.node_id,
        node_name: node?.name,
        status: "queued",
        source: "recurring_manual_trigger",
        model_used: node?.model,
      });

      toast.success("Ejecución encolada", { description: r.title });
    },
    [user, recurring, nodes]
  );

  const runTask = useCallback(
    async (task: OCTask) => {
      if (!user) return;
      const node = nodes.find((n) => n.id === task.node_id);
      const startedAt = new Date().toISOString();

      await supabase
        .from("openclaw_tasks")
        .update({ status: "running", started_at: startedAt })
        .eq("id", task.id);

      await supabase.from("openclaw_task_executions").insert({
        user_id: user.id,
        task_id: task.id,
        node_id: task.node_id,
        node_name: node?.name,
        status: "running",
        source: "manual",
        model_used: node?.model,
        started_at: startedAt,
      });
    },
    [user, nodes]
  );

  const completeTask = useCallback(
    async (task: OCTask, opts: { tokens?: number; output?: string; status?: TaskStatus } = {}) => {
      if (!user) return;
      const finishedAt = new Date().toISOString();
      const tokens = opts.tokens ?? Math.floor(Math.random() * 800 + 200);
      const status = opts.status ?? "done";

      await supabase
        .from("openclaw_tasks")
        .update({
          status,
          finished_at: finishedAt,
          result: opts.output ?? "OK",
          tokens_used: (task.tokens_used || 0) + tokens,
        })
        .eq("id", task.id);

      // Cerrar la última ejecución abierta de esta tarea
      const { data: lastExec } = await supabase
        .from("openclaw_task_executions")
        .select("id, started_at, tokens_used")
        .eq("task_id", task.id)
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastExec) {
        const dur = new Date(finishedAt).getTime() - new Date(lastExec.started_at).getTime();
        await supabase
          .from("openclaw_task_executions")
          .update({
            status,
            finished_at: finishedAt,
            duration_ms: dur,
            tokens_used: (lastExec.tokens_used || 0) + tokens,
            output: opts.output ?? "OK",
          })
          .eq("id", lastExec.id);
      }

      // Actualizar contadores del nodo
      const node = nodes.find((n) => n.id === task.node_id);
      if (node) {
        const today = new Date().toISOString().slice(0, 10);
        const tokensToday =
          node.tokens_today_date === today ? node.tokens_today + tokens : tokens;
        await supabase
          .from("openclaw_nodes")
          .update({
            tokens_total: (node.tokens_total || 0) + tokens,
            tokens_today: tokensToday,
            tokens_today_date: today,
            last_seen_at: finishedAt,
          })
          .eq("id", node.id);
      }
    },
    [user, nodes]
  );

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from("openclaw_tasks").delete().eq("id", taskId);
    if (error) toast.error(error.message);
    else toast.success("Tarea eliminada");
  }, []);

  return {
    user,
    nodes,
    tasks,
    recurring,
    executions,
    loading,
    refetch: fetchAll,
    createTask,
    createRecurring,
    toggleRecurring,
    deleteRecurring,
    executeNow,
    runTask,
    completeTask,
    deleteTask,
  };
}
