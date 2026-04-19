import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity, Cpu, Server, Plus, Loader2, RefreshCw, Play, CheckCircle2, XCircle, Clock,
  Zap, Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PageHero } from "@/components/ui/PageHero";

type Node = {
  id: string;
  name: string;
  host: string | null;
  model: string | null;
  status: string;
  last_seen_at: string | null;
  tokens_total: number;
  description: string | null;
};

type Task = {
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
};

type TaskLog = {
  id: string;
  task_id: string;
  level: string;
  message: string;
  created_at: string;
};

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; className: string }> = {
    online: { label: "Online", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    idle: { label: "Idle", className: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40" },
    offline: { label: "Offline", className: "bg-red-500/20 text-red-300 border-red-500/40" },
    running: { label: "Running", className: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
    pending: { label: "Pending", className: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    done: { label: "Done", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-300 border-red-500/40" },
  };
  const v = map[s] ?? { label: s, className: "bg-muted text-foreground" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
};

export default function OpenClawHub() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Record<string, TaskLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState<string | null>(null); // node_id
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("normal");

  // Asegura seed para usuarios creados después de la migración
  const ensureSeed = async (uid: string) => {
    const { data } = await supabase
      .from("openclaw_nodes")
      .select("name")
      .eq("user_id", uid);
    const names = new Set((data ?? []).map((n: any) => n.name));
    const seeds = [
      { name: "TITAN", host: "mac-mini-titan.local", model: "gpt-5", description: "Nodo principal de cómputo (Mac Mini M4 Pro)." },
      { name: "POTUS", host: "potus.bridge", model: "gemini-2.5-pro", description: "Bridge ejecutivo (Telegram MoltBot)." },
    ].filter((s) => !names.has(s.name));
    if (seeds.length) {
      await supabase
        .from("openclaw_nodes")
        .insert(seeds.map((s) => ({ ...s, user_id: uid, status: "idle" })));
    }
  };

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    await ensureSeed(user.id);
    const [nodesRes, tasksRes] = await Promise.all([
      supabase.from("openclaw_nodes").select("*").order("name"),
      supabase.from("openclaw_tasks").select("*").order("created_at", { ascending: false }),
    ]);
    setNodes((nodesRes.data ?? []) as Node[]);
    setTasks((tasksRes.data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "OpenClaw Hub | JARVIS";
    fetchAll();
    // realtime
    const ch = supabase
      .channel("openclaw-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_nodes" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_tasks" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "openclaw_task_logs" }, (p: any) => {
        const log = p.new as TaskLog;
        if (!log) return;
        setLogs((prev) => ({ ...prev, [log.task_id]: [...(prev[log.task_id] ?? []), log] }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const tasksByNode = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) (map[t.node_id] ??= []).push(t);
    return map;
  }, [tasks]);

  const openTaskLogs = async (task: Task) => {
    setSelectedTask(task);
    const { data } = await supabase
      .from("openclaw_task_logs")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setLogs((prev) => ({ ...prev, [task.id]: (data ?? []) as TaskLog[] }));
  };

  const createTask = async (nodeId: string) => {
    if (!user || !newTitle.trim()) return;
    const { data, error } = await supabase
      .from("openclaw_tasks")
      .insert({
        user_id: user.id,
        node_id: nodeId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("openclaw_task_logs").insert({
      user_id: user.id,
      task_id: data.id,
      level: "info",
      message: `Tarea creada con prioridad ${newPriority}`,
    });
    toast.success("Tarea creada");
    setNewTaskOpen(null);
    setNewTitle("");
    setNewDesc("");
    setNewPriority("normal");
  };

  const simulateRun = async (task: Task) => {
    if (!user) return;
    await supabase.from("openclaw_tasks").update({
      status: "running",
      started_at: new Date().toISOString(),
    }).eq("id", task.id);
    await supabase.from("openclaw_task_logs").insert({
      user_id: user.id, task_id: task.id, level: "info",
      message: "Ejecución iniciada (MVP simulado)",
    });
  };

  const markDone = async (task: Task) => {
    if (!user) return;
    await supabase.from("openclaw_tasks").update({
      status: "done",
      finished_at: new Date().toISOString(),
      result: "OK",
    }).eq("id", task.id);
    await supabase.from("openclaw_task_logs").insert({
      user_id: user.id, task_id: task.id, level: "info",
      message: "Tarea marcada como completada",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const onlineNodes = nodes.filter((n) => n.status === "online").length;
  const runningTasks = tasks.filter((t) => t.status === "running").length;
  const totalTokens = nodes.reduce((sum, n) => sum + (n.tokens_total || 0), 0);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
      <PageHero
        eyebrow="Centro de cómputo"
        eyebrowIcon={<Sparkles className="w-3 h-3" />}
        title={
          <>
            OpenClaw <span className="italic font-serif text-primary">Hub</span>
          </>
        }
        subtitle="Monitor de nodos, tareas y logs. Persistencia real en Supabase."
        actions={
          <Button variant="outline" size="sm" onClick={fetchAll} className="rounded-full">
            <RefreshCw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
        }
        stats={[
          { label: "Nodos online", value: `${onlineNodes}/${nodes.length}`, icon: <Server className="w-4 h-4" />, tone: "success" },
          { label: "Tareas activas", value: runningTasks, hint: `${tasks.length} totales`, icon: <Activity className="w-4 h-4" />, tone: "primary" },
          { label: "Tokens", value: totalTokens.toLocaleString(), hint: "consumidos", icon: <Zap className="w-4 h-4" />, tone: "accent" },
          { label: "Errores", value: tasks.filter((t) => t.status === "failed").length, hint: "últimas 24h", icon: <XCircle className="w-4 h-4" />, tone: "warning" },
        ]}
      />


      <div className="grid gap-4 md:grid-cols-2">
        {nodes.map((node) => {
          const nodeTasks = tasksByNode[node.id] ?? [];
          return (
            <Card key={node.id} className="border-border/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-primary" />
                      {node.name}
                    </CardTitle>
                    <CardDescription>{node.description}</CardDescription>
                  </div>
                  {statusBadge(node.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Modelo</p>
                    <p className="font-medium text-foreground">{node.model ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Host</p>
                    <p className="font-medium text-foreground truncate">{node.host ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tokens acumulados</p>
                    <p className="font-medium text-foreground">{node.tokens_total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last seen</p>
                    <p className="font-medium text-foreground">
                      {node.last_seen_at
                        ? formatDistanceToNow(new Date(node.last_seen_at), { addSuffix: true, locale: es })
                        : "Nunca"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tareas ({nodeTasks.length})
                  </p>
                  <Dialog open={newTaskOpen === node.id} onOpenChange={(o) => setNewTaskOpen(o ? node.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Nueva tarea
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nueva tarea para {node.name}</DialogTitle>
                        <DialogDescription>Persistente y observable en tiempo real.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          placeholder="Título de la tarea"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="Descripción (opcional)"
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                        />
                        <Select value={newPriority} onValueChange={setNewPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baja</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="critical">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button className="w-full" onClick={() => createTask(node.id)}>
                          Crear
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <ScrollArea className="h-56 rounded-md border border-border/40">
                  <div className="p-2 space-y-1">
                    {nodeTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">
                        Sin tareas. Crea una para empezar.
                      </p>
                    )}
                    {nodeTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTaskLogs(t)}
                        className="w-full text-left p-2 rounded hover:bg-muted/50 transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}
                            {" · "}{t.tokens_used} tk
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {statusBadge(t.status)}
                          {t.status === "pending" && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); simulateRun(t); }}>
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {t.status === "running" && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); markDone(t); }}>
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog log detalle */}
      <Dialog open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {selectedTask?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedTask && statusBadge(selectedTask.status)}
              {selectedTask?.description && (
                <span className="block mt-2 text-foreground">{selectedTask.description}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-80 rounded border border-border/40 bg-muted/20">
            <div className="p-3 space-y-1 font-mono text-xs">
              {(logs[selectedTask?.id ?? ""] ?? []).length === 0 && (
                <p className="text-muted-foreground">Sin entradas de log todavía.</p>
              )}
              {(logs[selectedTask?.id ?? ""] ?? []).map((l) => (
                <div key={l.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(l.created_at).toLocaleTimeString()}
                  </span>
                  <Badge variant="outline" className="h-4 px-1 text-[10px] shrink-0">
                    {l.level}
                  </Badge>
                  <span className="text-foreground break-all">{l.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
