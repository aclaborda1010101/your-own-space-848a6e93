import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Loader2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Euro,
  HeartPulse,
  PlayCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  TerminalSquare,
  TimerReset,
  WalletCards,
  Workflow,
  ListTodo,
  Wrench,
  X,
} from "lucide-react";

type StatusTone = "healthy" | "warning" | "critical" | "idle" | "running";
type PeriodKey = "day" | "week" | "month";

interface AgentCardData {
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

interface TaskItem {
  id: string;
  title: string;
  owner: string;
  priority: "alta" | "media" | "baja";
  status: "en cola" | "en curso" | "bloqueada" | "lista";
  eta: string;
  detail: string;
  createdAt: string;
  scope: string;
  nextStep: string;
  blockedBy?: string;
}

interface RunItem {
  id: string;
  flow: string;
  node: string;
  status: StatusTone;
  startedAt: string;
  duration: string;
  detail: string;
}

interface HealthItem {
  label: string;
  value: string;
  status: StatusTone;
  note: string;
}

interface CostModelItem {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalCostEur: number;
  calls: number;
}

interface CostPeriodData {
  totalCostEur: number;
  totalTokens: number;
  totalCalls: number;
  avgCostPerCall: number;
  models: CostModelItem[];
}

const fallbackAgents: AgentCardData[] = [
  { id: "potus", name: "POTUS", role: "Coordinador / routing", host: "Mac Mini M4 · 192.168.1.10", model: "claude-sonnet-4-6", status: "healthy", load: 0, queue: 0, lastSeen: "ahora", detail: "Gateway activo", currentWork: "Monitorización activa", lastAction: "Nodo principal", nextAction: "Aceptar tareas", progressLabel: "vivo", progressPercent: 100 },
  { id: "titan", name: "TITAN", role: "Frames + desarrollo", host: "MacBook Pro M4 · 192.168.1.72", model: "deepseek-reasoner", status: "healthy", load: 0, queue: 0, lastSeen: "ahora", detail: "Respuesta ICMP OK", currentWork: "En espera", lastAction: "Último build OK", nextAction: "Aceptar tarea", progressLabel: "vivo", progressPercent: 100 },
  { id: "jarvis", name: "JARVIS", role: "Audio + comunicaciones", host: "Toshiba i7 · 192.168.1.20", model: "gemini-flash", status: "healthy", load: 0, queue: 0, lastSeen: "ahora", detail: "Respuesta ICMP OK", currentWork: "En espera", lastAction: "Último ping OK", nextAction: "Aceptar tarea", progressLabel: "vivo", progressPercent: 100 },
  { id: "atlas", name: "ATLAS", role: "Film DB + GPU", host: "AMD R9 · 192.168.1.45", model: "deepseek-reasoner", status: "critical", load: 0, queue: 0, lastSeen: "sin respuesta", detail: "No responde al ping", currentWork: "Offline", lastAction: "Último probe fallido", nextAction: "Verificar red", progressLabel: "offline", progressPercent: 0 },
];
const mockAgents: AgentCardData[] = fallbackAgents;

const mockTasks: TaskItem[] = [
  {
    id: "tsk-201",
    title: "Sincronizar skill inventory con JARVIS",
    owner: "POTUS",
    priority: "alta",
    status: "en curso",
    eta: "15 min",
    detail: "Cruce entre skills instaladas, catálogo esperado y estado del relay de JARVIS para dejar inventario consistente.",
    createdAt: "hoy · 07:12",
    scope: "OpenClaw / runtime",
    nextStep: "Validar diff final y publicar snapshot al dashboard.",
  },
  {
    id: "tsk-202",
    title: "Revisión de runs fallidos del pipeline RAG",
    owner: "ATLAS",
    priority: "media",
    status: "en cola",
    eta: "45 min",
    detail: "Analizar runs con latencia anómala en embeddings, detectar patrón y preparar reintento por lote.",
    createdAt: "hoy · 06:48",
    scope: "RAG / embeddings",
    nextStep: "Levantar lote de diagnóstico con métricas de throughput por nodo.",
  },
  {
    id: "tsk-203",
    title: "Hardening básico del gateway LAN",
    owner: "POTUS",
    priority: "alta",
    status: "bloqueada",
    eta: "esperando validación",
    detail: "Aplicar ajuste base de exposición, revisar puertos y dejar checklist de endurecimiento mínimo para la LAN.",
    createdAt: "ayer · 22:09",
    scope: "Gateway / seguridad",
    nextStep: "Confirmar ventana segura para tocar conectividad.",
    blockedBy: "Requiere validación manual antes de cambiar reglas de acceso.",
  },
  {
    id: "tsk-204",
    title: "Chequeo diario de disco + ffmpeg",
    owner: "TITAN",
    priority: "baja",
    status: "lista",
    eta: "completada",
    detail: "Verificación rutinaria de volumen externo, espacio disponible y procesos ffmpeg activos en cola de frames.",
    createdAt: "hoy · 05:55",
    scope: "Frames / storage",
    nextStep: "Programar siguiente revisión automática según heartbeat.",
  },
];

const mockRuns: RunItem[] = [
  {
    id: "run-8841",
    flow: "openclaw.gateway.healthcheck",
    node: "POTUS",
    status: "healthy",
    startedAt: "07:21",
    duration: "00:18",
    detail: "Última revisión completa del gateway sin errores críticos.",
  },
  {
    id: "run-8840",
    flow: "jarvis.voice.realtime",
    node: "JARVIS",
    status: "running",
    startedAt: "07:18",
    duration: "05:12",
    detail: "Sesión en vivo con canal de audio abierto y websocket estable.",
  },
  {
    id: "run-8838",
    flow: "atlas.rag.embed.batch",
    node: "ATLAS",
    status: "warning",
    startedAt: "06:54",
    duration: "12:40",
    detail: "Lote activo con latencia alta en embeddings y cola contenida.",
  },
  {
    id: "run-8835",
    flow: "titan.frames.extract",
    node: "TITAN",
    status: "critical",
    startedAt: "06:11",
    duration: "00:43",
    detail: "Interrumpido por volumen no montado. Requiere reintento.",
  },
];

const mockHealth: HealthItem[] = [
  {
    label: "Gateway",
    value: "Online",
    status: "healthy",
    note: "Heartbeat y relay disponibles desde POTUS.",
  },
  {
    label: "WebSocket",
    value: "99.2%",
    status: "healthy",
    note: "Conectividad estable durante la última hora.",
  },
  {
    label: "Cola de jobs",
    value: "13 activos",
    status: "warning",
    note: "Pico moderado en ATLAS/JARVIS.",
  },
  {
    label: "Storage externo",
    value: "No montado",
    status: "critical",
    note: "My Book Duo no está listo para extracción de frames.",
  },
];

const mockEarlyInterventions: EarlyInterventionIndicator[] = [
  {
    id: "ei-001",
    type: "drift",
    severity: "medium",
    title: "Desviación en latencia de embeddings",
    description: "La latencia promedio de embeddings ha aumentado un 15% en las últimas 2 horas.",
    affectedAgent: "ATLAS",
    createdAt: "hoy · 06:30",
  },
  {
    id: "ei-002",
    type: "stale_task",
    severity: "high",
    title: "Tarea bloqueada > 24h",
    description: "Hardening básico del gateway LAN espera validación manual desde ayer.",
    affectedAgent: "POTUS",
    createdAt: "ayer · 22:09",
  },
  {
    id: "ei-003",
    type: "approval_pending",
    severity: "low",
    title: "Aprobación pendiente para despliegue",
    description: "Cambios en skill inventory requieren revisión antes de sincronizar con JARVIS.",
    affectedAgent: "POTUS",
    createdAt: "hoy · 07:15",
  },
  {
    id: "ei-004",
    type: "degraded_node",
    severity: "high",
    title: "Nodo ATLAS con carga > 80%",
    description: "Carga sostenida por encima del 80% durante 30 minutos, riesgo de colapso.",
    affectedAgent: "ATLAS",
    createdAt: "hoy · 07:00",
  },
];

const mockTaskQueue: TaskQueueItem[] = [
  {
    id: "tq-101",
    jobType: "expensive_computation",
    title: "Procesamiento de lote de frames (5000 imágenes)",
    status: "pending",
    priority: "high",
    estimatedCost: 12.5,
    estimatedDuration: "2h 30m",
    progress: 0,
    assignedAgent: "TITAN",
    createdAt: "hoy · 06:00",
  },
  {
    id: "tq-102",
    jobType: "batch_processing",
    title: "Embeddings de documentos RAG (10k docs)",
    status: "running",
    priority: "critical",
    estimatedCost: 8.2,
    estimatedDuration: "1h 15m",
    progress: 45,
    assignedAgent: "ATLAS",
    createdAt: "hoy · 05:30",
    startedAt: "hoy · 06:45",
  },
  {
    id: "tq-103",
    jobType: "model_training",
    title: "Fine-tuning modelo clasificador",
    status: "pending",
    priority: "medium",
    estimatedCost: 25.0,
    estimatedDuration: "4h",
    progress: 0,
    assignedAgent: "POTUS",
    createdAt: "ayer · 20:00",
  },
  {
    id: "tq-104",
    jobType: "data_export",
    title: "Exportar logs de costes a Supabase",
    status: "completed",
    priority: "low",
    estimatedCost: 0.5,
    estimatedDuration: "15m",
    progress: 100,
    assignedAgent: "JARVIS",
    createdAt: "hoy · 04:00",
    startedAt: "hoy · 04:10",
    completedAt: "hoy · 04:25",
  },
];

const mockCostByPeriod: Record<PeriodKey, CostPeriodData> = {
  day: {
    totalCostEur: 8.74,
    totalTokens: 1_824_000,
    totalCalls: 214,
    avgCostPerCall: 0.0408,
    models: [
      { model: "Claude Sonnet 4.6", provider: "Anthropic", inputTokens: 412_000, outputTokens: 133_000, totalCostEur: 3.92, calls: 48 },
      { model: "DeepSeek v3.2", provider: "DeepSeek", inputTokens: 503_000, outputTokens: 188_000, totalCostEur: 1.46, calls: 92 },
      { model: "Gemini Flash", provider: "Google", inputTokens: 351_000, outputTokens: 124_000, totalCostEur: 0.86, calls: 43 },
      { model: "Whisper", provider: "OpenAI", inputTokens: 287_000, outputTokens: 0, totalCostEur: 0.62, calls: 19 },
      { model: "Embeddings", provider: "OpenAI", inputTokens: 0, outputTokens: 0, totalCostEur: 1.88, calls: 12 },
    ],
  },
  week: {
    totalCostEur: 51.37,
    totalTokens: 11_942_000,
    totalCalls: 1426,
    avgCostPerCall: 0.0360,
    models: [
      { model: "Claude Sonnet 4.6", provider: "Anthropic", inputTokens: 2_850_000, outputTokens: 1_024_000, totalCostEur: 21.84, calls: 331 },
      { model: "DeepSeek v3.2", provider: "DeepSeek", inputTokens: 3_112_000, outputTokens: 1_180_000, totalCostEur: 8.92, calls: 602 },
      { model: "Gemini Flash", provider: "Google", inputTokens: 2_240_000, outputTokens: 701_000, totalCostEur: 4.31, calls: 261 },
      { model: "Whisper", provider: "OpenAI", inputTokens: 1_010_000, outputTokens: 0, totalCostEur: 3.65, calls: 137 },
      { model: "Embeddings", provider: "OpenAI", inputTokens: 0, outputTokens: 0, totalCostEur: 12.65, calls: 95 },
    ],
  },
  month: {
    totalCostEur: 228.64,
    totalTokens: 54_330_000,
    totalCalls: 6240,
    avgCostPerCall: 0.0366,
    models: [
      { model: "Claude Sonnet 4.6", provider: "Anthropic", inputTokens: 12_460_000, outputTokens: 4_540_000, totalCostEur: 97.33, calls: 1498 },
      { model: "DeepSeek v3.2", provider: "DeepSeek", inputTokens: 14_900_000, outputTokens: 5_210_000, totalCostEur: 38.12, calls: 2742 },
      { model: "Gemini Flash", provider: "Google", inputTokens: 10_760_000, outputTokens: 3_510_000, totalCostEur: 20.21, calls: 1118 },
      { model: "Whisper", provider: "OpenAI", inputTokens: 4_080_000, outputTokens: 0, totalCostEur: 14.78, calls: 544 },
      { model: "Embeddings", provider: "OpenAI", inputTokens: 0, outputTokens: 0, totalCostEur: 58.20, calls: 338 },
    ],
  },
};

const periodLabels: Record<PeriodKey, string> = {
  day: "Hoy",
  week: "Semana",
  month: "Mes",
};

const statusConfig: Record<StatusTone, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  healthy: {
    label: "saludable",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  running: {
    label: "ejecutando",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    icon: PlayCircle,
  },
  warning: {
    label: "atención",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: AlertTriangle,
  },
  critical: {
    label: "crítico",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    icon: AlertTriangle,
  },
  idle: {
    label: "idle",
    className: "border-muted bg-muted/30 text-muted-foreground",
    icon: Clock3,
  },
};

const priorityClass: Record<TaskItem["priority"], string> = {
  alta: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  baja: "border-muted bg-muted/30 text-muted-foreground",
};

const taskStatusClass: Record<TaskItem["status"], string> = {
  "en cola": "text-muted-foreground",
  "en curso": "text-sky-400",
  bloqueada: "text-rose-400",
  lista: "text-emerald-400",
};

interface LiveLogItem {
  timestamp: string;
  agent: string;
  status: string;
  message: string;
}

interface EarlyInterventionIndicator {
  id: string;
  type: "drift" | "stale_task" | "approval_pending" | "degraded_node";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  affectedAgent?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface TaskQueueItem {
  id: string;
  jobType: "expensive_computation" | "batch_processing" | "model_training" | "data_export";
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  priority: "critical" | "high" | "medium" | "low";
  estimatedCost: number;
  estimatedDuration: string;
  progress: number;
  assignedAgent?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface SnapshotData {
  generatedAt: string;
  source: string;
  agents: AgentCardData[];
  tasks: TaskItem[];
  runs: RunItem[];
  health: HealthItem[];
  liveLog?: LiveLogItem[];
  costByPeriod?: Record<PeriodKey, CostPeriodData>;
  earlyInterventions?: EarlyInterventionIndicator[];
  taskQueue?: TaskQueueItem[];
}

const StatusBadge = ({ status }: { status: StatusTone }) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const formatCurrency = (value: number) => `€${value.toFixed(value >= 10 ? 2 : 3)}`;

const formatCompactNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
};

const OpenClaw = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("week");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [localTasks, setLocalTasks] = useState<TaskItem[] | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("agents");
  const [filter, setFilter] = useState<"all" | "running" | "blocked" | "closed">("all");

  const deleteTask = (id: string) => {
    setDeletedIds(prev => { const s = new Set(prev); s.add(id); return s; });
    setLocalTasks(prev => {
      const base = prev ?? (snapshot?.tasks ?? mockTasks);
      return base.filter(t => t.id !== id);
    });
    if (selectedTask?.id === id) setSelectedTask(null);
    toast({ title: "Tarea eliminada", description: `ID ${id} eliminada de la lista`, variant: "default" });
  };
  const togglePause = (id: string) => {
    // Implementar lógica de pausa (pendiente)
    toast({ title: "Función en desarrollo", description: "Pausar/Reanudar tarea pronto disponible", variant: "default" });
  };
  const handleModelChange = (agentId: string, model: string) => {
    toast({ title: "Modelo actualizado", description: `Agente ${agentId} cambiado a ${model}`, variant: "default" });
    // En una implementación real, se enviaría al bridge
  };
  const [opStatus, setOpStatus] = useState<string | null>(null);
  const [loadingOps, setLoadingOps] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const refreshSnapshot = async () => {
    setLoadingSnapshot(true);
    let source = "bridge";
    try {
      const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
      const res = await fetch(`${bridgeBase}/api/openclaw/snapshot?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`snapshot ${res.status}`);
      const data = await res.json();
      setSnapshot(data);
      toast({ title: "Snapshot actualizado", description: `Datos en vivo desde bridge · ${new Date().toLocaleTimeString()}`, variant: "default" });
    } catch (error) {
      source = "static";
      try {
        const res = await fetch(`/openclaw-snapshot.json?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setSnapshot(data);
          toast({ title: "Snapshot cargado", description: `Desde archivo estático (bridge no disponible) · ${new Date().toLocaleTimeString()}`, variant: "default" });
        } else {
          throw new Error("static fetch failed");
        }
      } catch {
        toast({ title: "Error al cargar snapshot", description: "Bridge y archivo estático no disponibles.", variant: "destructive" });
      }
    } finally {
      setLoadingSnapshot(false);
    }
    return source;
  };

  const runNodeOp = async (node: string, action: "restart" | "restore") => {
    const opKey = `${node}-${action}`;
    setLoadingOps(prev => ({ ...prev, [opKey]: true }));
    setOpStatus(`${action} ${node}...`);
    try {
      // Intentar bridge local primero
      const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
      const url = `${bridgeBase}/api/openclaw/op`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "op failed");
      setOpStatus(data?.message || `${action} ${node} lanzado`);
      toast({
        title: "Acción completada",
        description: data?.message || `${action} ${node} ejecutado correctamente`,
        variant: "default",
      });
    } catch (error) {
      console.warn("Bridge no disponible, fallback a función Supabase", error);
      // Fallback a Supabase
      try {
        const url = `${SUPABASE_URL}/functions/v1/openclaw-ops`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ node, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "op failed");
        setOpStatus(data?.message || `${action} ${node} lanzado`);
        toast({
          title: "Acción completada",
          description: data?.message || `${action} ${node} ejecutado correctamente`,
          variant: "default",
        });
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : `Error ejecutando ${action}`;
        setOpStatus(errorMessage);
        toast({
          title: "Error en la acción",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoadingOps(prev => ({ ...prev, [opKey]: false }));
    }
  };

  useEffect(() => {
    refreshSnapshot();
    const timer = window.setInterval(refreshSnapshot, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const agents = snapshot?.agents ?? mockAgents;
  const tasks = localTasks ?? (snapshot?.tasks ?? mockTasks);
  const runs = snapshot?.runs ?? mockRuns;
  const health = snapshot?.health ?? mockHealth;
  const liveLog = snapshot?.liveLog ?? [];
  const earlyInterventions = snapshot?.earlyInterventions ?? mockEarlyInterventions;
  const taskQueue = snapshot?.taskQueue ?? mockTaskQueue;
  const hasRealCosts = Boolean(snapshot?.costByPeriod);
  
  // Combinar tasks y taskQueue en una lista unificada
  const unifiedTasks = useMemo(() => {
    const taskItems = tasks.map(task => ({
      id: task.id,
      title: task.title,
      owner: task.owner,
      priority: task.priority,
      status: task.status,
      eta: task.eta,
      progress: 0,
      type: 'task' as const,
      subagents: [] // TODO: extraer subagentes del snapshot
    }));
    const queueItems = taskQueue.map(job => ({
      id: job.id,
      title: job.title,
      owner: job.assignedAgent || 'Sin asignar',
      priority: job.priority,
      status: job.status,
      eta: job.estimatedDuration,
      progress: job.progress || 0,
      type: 'queue' as const,
      subagents: [] // TODO: extraer subagentes del snapshot
    }));
    return [...taskItems, ...queueItems].filter(t => !deletedIds.has(t.id));
  }, [tasks, taskQueue, deletedIds]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'running':
        return unifiedTasks.filter(t => t.status === 'running' || t.status === 'en curso');
      case 'blocked':
        return unifiedTasks.filter(t => t.status === 'blocked' || t.status === 'bloqueada');
      case 'closed':
        return unifiedTasks.filter(t => t.status === 'completed' || t.status === 'cerrada' || t.status === 'lista');
      default:
        return unifiedTasks;
    }
  }, [unifiedTasks, filter]);
  const costByPeriod = snapshot?.costByPeriod ?? mockCostByPeriod;
  const summary = {
    activeAgents: agents.filter((agent) => ["healthy", "running", "warning"].includes(agent.status)).length,
    queuedTasks: tasks.filter((task) => task.status === "en cola" || task.status === "en curso").length,
    activeRuns: runs.filter((run) => run.status === "running" || run.status === "warning").length,
    incidents: health.filter((item) => item.status === "critical" || item.status === "warning").length,
  };

  const costData = costByPeriod[selectedPeriod];
  const costModels = useMemo(
    () => [...costData.models].sort((a, b) => b.totalCostEur - a.totalCostEur),
    [costData],
  );

  return (
    <>
      <main className="p-4 lg:p-6 space-y-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky-500 shadow-lg shadow-primary/20">
              <TerminalSquare className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">OpenClaw</h1>
              <p className="text-sm text-muted-foreground font-mono">
                DASHBOARD OPERATIVO · agentes, costes IA, runs y backlog
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {snapshot ? `LIVE · ${new Date(snapshot.generatedAt).toLocaleTimeString()}` : "SNAPSHOT · cargando"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshSnapshot}>
              <RefreshCw className={cn("h-4 w-4", loadingSnapshot && "animate-spin")} />
              Refrescar snapshot
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setActiveTab("runs"); setTimeout(() => document.getElementById("openclaw-runs")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}>
              <ArrowUpRight className="h-4 w-4" />
              Ver runs completos
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{summary.activeAgents}</p>
                <p className="text-xs text-muted-foreground">Agentes visibles</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <Workflow className="h-5 w-5 text-sky-400" />
              <div>
                <p className="text-2xl font-bold">{summary.queuedTasks}</p>
                <p className="text-xs text-muted-foreground">Tareas activas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-2xl font-bold">{summary.activeRuns}</p>
                <p className="text-xs text-muted-foreground">Runs en movimiento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <HeartPulse className="h-5 w-5 text-rose-400" />
              <div>
                <p className="text-2xl font-bold">{summary.incidents}</p>
                <p className="text-xs text-muted-foreground">Alertas / incidentes</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {hasRealCosts ? (
        <Card className="border-border bg-card overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  Costes IA
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Consumo consolidado por periodo y modelo.</p>
              </div>
              <div className="w-full lg:w-[180px]">
                <Select value={selectedPeriod} onValueChange={(value: PeriodKey) => setSelectedPeriod(value)}>
                  <SelectTrigger className="bg-background/60">
                    <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Euro} label={`Coste total · ${periodLabels[selectedPeriod]}`} value={formatCurrency(costData.totalCostEur)} note="Suma consolidada de consumo IA" />
              <MetricCard icon={WalletCards} label="Coste medio / llamada" value={formatCurrency(costData.avgCostPerCall)} note={`${costData.totalCalls} llamadas registradas`} />
              <MetricCard icon={Cpu} label="Tokens totales" value={formatCompactNumber(costData.totalTokens)} note="Entrada + salida" />
              <MetricCard icon={Bot} label="Modelos activos" value={`${costModels.length}`} note="Con reparto individual visible" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-border bg-background/40">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Coste por modelo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {costModels.map((item) => {
                    const percentage = costData.totalCostEur > 0 ? (item.totalCostEur / costData.totalCostEur) * 100 : 0;
                    return (
                      <div key={item.model} className="rounded-xl border border-border bg-background/60 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{item.model}</p>
                              <Badge variant="outline" className="text-xs border-border text-muted-foreground">{item.provider}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono"><span>IN {formatCompactNumber(item.inputTokens)}</span><span>OUT {formatCompactNumber(item.outputTokens)}</span><span>CALLS {item.calls}</span></div>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(item.totalCostEur)}</p>
                            <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% del total</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1"><div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Peso en coste</span><span>{percentage.toFixed(1)}%</span></div><Progress value={percentage} /></div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <Card className="border-border bg-background/40">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Lectura rápida</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-medium text-foreground">Modelo dominante</p><p className="mt-1 text-muted-foreground">{costModels[0].model} concentra {((costModels[0].totalCostEur / costData.totalCostEur) * 100).toFixed(1)}% del gasto en {periodLabels[selectedPeriod].toLowerCase()}.</p></div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="font-medium text-foreground">Foco de optimización</p><p className="mt-1 text-muted-foreground">Embeddings + modelos premium ya justifican estructura para alertas y topes por periodo.</p></div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
        ) : (
        <Card className="border-border bg-card overflow-hidden">
          <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-primary" />Costes IA</CardTitle></CardHeader>
          <CardContent><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">Costes ocultos hasta conectar datos reales de consumo por nodo/modelo.</div></CardContent>
        </Card>
        )}
        {opStatus && (
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">{opStatus}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="agents" className="space-y-4" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid h-auto grid-cols-2 gap-2 md:grid-cols-8">
            <TabsTrigger value="agents" className="gap-2"><Bot className="h-4 w-4" />Agentes</TabsTrigger>
            <TabsTrigger value="control" className="gap-2"><Workflow className="h-4 w-4" />Control</TabsTrigger>
            <TabsTrigger value="runs" className="gap-2"><PlayCircle className="h-4 w-4" />Runs / estado</TabsTrigger>
            <TabsTrigger value="health" className="gap-2"><ShieldCheck className="h-4 w-4" />Salud sistema</TabsTrigger>
            <TabsTrigger value="log" className="gap-2"><Activity className="h-4 w-4" />Live log</TabsTrigger>
            <TabsTrigger value="mission" className="gap-2"><AlertTriangle className="h-4 w-4" />Intervención</TabsTrigger>
            <TabsTrigger value="subagents" className="gap-2"><ListTodo className="h-4 w-4" />Subagentes</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <Card key={agent.id} className="border-border bg-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Bot className="h-4 w-4 text-primary" />
                            {agent.name}
                          </CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">{agent.role}</p>
                        </div>
                        <StatusBadge status={agent.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Host</p>
                          <p className="font-medium text-foreground">{agent.host}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Modelo</p>
                          <Select value={agent.model} onValueChange={(value) => handleModelChange(agent.id, value)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Selecciona modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                              <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
                              <SelectItem value="gemini-flash">Gemini Flash</SelectItem>
                              <SelectItem value="qwen-2.5-coder">Qwen 2.5 Coder</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Carga actual</span>
                          <span className="font-medium text-foreground">{agent.load}%</span>
                        </div>
                        <Progress value={agent.load} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Cola: {agent.queue} items</span>
                        <span>{agent.lastSeen}</span>
                      </div>
                      <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground space-y-2">
                        <div><span className="text-foreground font-medium">Haciendo:</span> {agent.currentWork || "Sin tarea activa"}</div>
                        <div><span className="text-foreground font-medium">Último:</span> {agent.lastAction || "Sin actualización"}</div>
                        <div><span className="text-foreground font-medium">Siguiente:</span> {agent.nextAction || "Esperando instrucción"}</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-foreground font-medium">Progreso</span>
                            <span>{agent.progressLabel || "sin medir"}</span>
                          </div>
                          <Progress value={agent.progressPercent || 0} />
                        </div>
                      </div>
                      {/* Subagentes desplegados */}
                      {(() => {
                        const agentRuns = runs.filter(r => r.node?.toLowerCase() === agent.name.toLowerCase() || r.node?.toLowerCase() === agent.id);
                        return agentRuns.length > 0 ? (
                          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs space-y-2">
                            <p className="text-foreground font-medium flex items-center gap-1.5">
                              <Bot className="h-3 w-3 text-primary" />
                              Subagentes desplegados ({agentRuns.length})
                            </p>
                            {agentRuns.map(run => (
                              <div key={run.id} className="flex items-center justify-between text-muted-foreground">
                                <span className="flex-1 truncate">{run.flow || run.id}</span>
                                <Badge variant="outline" className={`ml-2 shrink-0 text-[10px] ${run.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' : run.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-muted/20'}`}>
                                  {run.status === 'running' ? 'activo' : run.status === 'critical' ? 'error' : run.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border/50 bg-background/30 p-2 text-xs text-muted-foreground text-center">
                            Sin subagentes desplegados
                          </div>
                        );
                      })()}
                      {agent.lastBackup && (
                        <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                          <div>Último backup: {agent.lastBackup}</div>
                          {agent.restoreStatus && <div className="mt-1">Estado restore: {agent.restoreStatus}</div>}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {(() => {
                          const loadingRestore = loadingOps[`${agent.id}-restore`];
                          const loadingRestart = loadingOps[`${agent.id}-restart`];
                          return (
                            <>
                              <Button variant="outline" size="sm" onClick={() => runNodeOp(agent.id, "restore")} disabled={loadingRestore}>
                                {loadingRestore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Recuperar gateway
                              </Button>
                              <Button size="sm" onClick={() => runNodeOp(agent.id, "restart")} disabled={loadingRestart}>
                                {loadingRestart && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Reiniciar
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => toast({ title: "Subagentes", description: `Ver subagentes de ${agent.name}`, variant: "default" })}>
                                Ver subagentes
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border bg-card flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Actividad en tiempo real
                    <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[340px] px-4 pb-4">
                    <div className="space-y-2 pt-1">
                      {/* Actividad por agente desde snapshot */}
                      {agents.map(agent => (
                        <div key={agent.id} className="rounded-lg border border-border bg-background/40 p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${agent.status === 'healthy' ? 'bg-emerald-500' : agent.status === 'warning' ? 'bg-amber-500' : 'bg-destructive'}`} />
                              {agent.name}
                            </span>
                            <span className="text-muted-foreground">{agent.lastSeen}</span>
                          </div>
                          <p className="text-foreground/80 leading-relaxed">
                            {agent.currentWork && agent.currentWork !== 'Sin tarea activa' ? (
                              <><span className="text-primary font-medium">▶ </span>{agent.currentWork}</>
                            ) : (
                              <span className="text-muted-foreground italic">En espera de instrucciones</span>
                            )}
                          </p>
                          {agent.lastAction && agent.lastAction !== 'Sin actualización' && (
                            <p className="text-muted-foreground mt-0.5">↩ {agent.lastAction}</p>
                          )}
                        </div>
                      ))}
                      {/* Log de sesiones recientes */}
                      {liveLog.length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground font-medium pt-2 pb-1">Sesiones recientes</p>
                          {liveLog.slice(0, 8).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                              <span className="text-muted-foreground shrink-0 w-[72px]">{item.timestamp}</span>
                              <span className="font-medium text-primary shrink-0 w-[52px]">{item.agent}</span>
                              <span className="text-foreground/80 flex-1">{item.message}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="control" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-primary" />
                    Control de tareas
                    <Badge variant="outline" className="ml-2">{tasks.length + taskQueue.length} tareas</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Agentes activos: <strong>{agents.filter(a => a.status === 'healthy').length}/{agents.length}</strong></span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Todas</Button>
                  <Button variant={filter === 'running' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('running')}>En curso</Button>
                  <Button variant={filter === 'blocked' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('blocked')}>Bloqueadas</Button>
                  <Button variant={filter === 'closed' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('closed')}>Cerradas</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium text-foreground">{task.title}</h4>
                            <Badge variant="outline" className={priorityClass[task.priority]}>{task.priority}</Badge>
                            <Badge variant={task.status === 'running' ? 'default' : 'outline'}>{task.status}</Badge>
                            <span className="text-xs text-muted-foreground">Owner: {task.owner}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">ID</p>
                              <p className="font-medium">{task.id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">ETA</p>
                              <p className="font-medium">{task.eta}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Progreso</p>
                              <p className="font-medium">{task.progress || 0}%</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => togglePause(task.id)}>
                            {task.paused ? 'Reanudar' : 'Pausar'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteTask(task.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                      {/* Subagentes expandible */}
                      <div className="mt-4 pl-4 border-l border-border">
                        <p className="text-xs text-muted-foreground mb-2">Subagentes ({task.subagents?.length || 0})</p>
                        {task.subagents && task.subagents.length > 0 ? (
                          <div className="space-y-2">
                            {task.subagents.map((sub: any) => (
                              <div key={sub.id} className="flex items-center justify-between text-sm">
                                <div>
                                  <span className="font-medium">{sub.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">({sub.specialty})</span>
                                </div>
                                <Badge variant="outline" className={sub.status === 'running' ? 'bg-green-500/20' : sub.status === 'idle' ? 'bg-yellow-500/20' : 'bg-gray-500/20'}>
                                  {sub.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No hay subagentes desplegados</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-4" id="openclaw-runs">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Timeline reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[420px] pr-4">
                    <div className="space-y-4">
                      {runs.map((run, index) => (
                        <div key={run.id} className="relative pl-6">
                          {index !== runs.length - 1 && (
                            <span className="absolute left-[7px] top-6 h-[calc(100%+12px)] w-px bg-border" />
                          )}
                          <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border border-border bg-background" />
                          <div className="rounded-xl border border-border bg-background/40 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-foreground">{run.flow}</p>
                                <p className="text-xs text-muted-foreground">{run.id} · nodo {run.node}</p>
                              </div>
                              <StatusBadge status={run.status} />
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">{run.detail}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Inicio {run.startedAt}</span>
                              <span>Duración {run.duration}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    Estado rápido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="font-medium text-foreground">Último run estable</p>
                    <p className="mt-1 text-muted-foreground">openclaw.gateway.healthcheck en POTUS</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="font-medium text-foreground">Run a vigilar</p>
                    <p className="mt-1 text-muted-foreground">atlas.rag.embed.batch con latencia por encima del rango normal</p>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="font-medium text-foreground">Incidente pendiente</p>
                    <p className="mt-1 text-muted-foreground">titan.frames.extract requiere storage externo montado antes de reintentar</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="log" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Live log operativo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveLog.length === 0 ? (
                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">Sin eventos todavía.</div>
                ) : liveLog.map((item, idx) => (
                  <div key={`${item.timestamp}-${idx}`} className="rounded-xl border border-border bg-background/40 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="outline">{item.agent}</Badge>
                      <Badge variant="secondary">{item.status}</Badge>
                      <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                    </div>
                    <div className="text-muted-foreground">{item.message}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {health.map((item) => (
                <Card key={item.label} className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{item.value}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{item.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Mapa de conexión futura
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Fuente primaria</p>
                  <p className="mt-1 font-medium text-foreground">Gateway / OpenClaw runtime</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Tiempo real</p>
                  <p className="mt-1 font-medium text-foreground">WebSocket / polling suave</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Persistencia</p>
                  <p className="mt-1 font-medium text-foreground">Supabase / logs curados</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Acciones</p>
                  <p className="mt-1 font-medium text-foreground">Reintentos, refresh, drill-down</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mission" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Panel de intervención temprana
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Indicadores de drift, tareas estancadas, aprobaciones pendientes y nodos degradados.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {earlyInterventions.map((indicator) => {
                  const severityColor = {
                    low: "bg-emerald-500/20 text-emerald-700 border-emerald-300",
                    medium: "bg-amber-500/20 text-amber-700 border-amber-300",
                    high: "bg-rose-500/20 text-rose-700 border-rose-300",
                  }[indicator.severity];
                  return (
                    <div key={indicator.id} className={`rounded-xl border p-4 ${severityColor}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide">{indicator.type}</span>
                            <Badge variant="outline" className="capitalize">{indicator.severity}</Badge>
                          </div>
                          <h4 className="mt-2 font-medium">{indicator.title}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">{indicator.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Creado</p>
                          <p className="text-sm font-medium">{indicator.createdAt}</p>
                          {indicator.affectedAgent && (
                            <p className="mt-2 text-xs text-muted-foreground">Agente: {indicator.affectedAgent}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>



        </Tabs>


      </main>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-xl border-border bg-card">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  <Badge variant="outline" className={priorityClass[selectedTask.priority]}>
                    prioridad {selectedTask.priority}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {selectedTask.id}
                  </Badge>
                </div>
                <DialogTitle className="text-left text-xl">{selectedTask.title}</DialogTitle>
                <DialogDescription className="text-left">
                  Detalle MVP de tarea OpenClaw para abrir backlog sin salir del dashboard.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailBox label="Owner" value={selectedTask.owner} />
                  <DetailBox label="Estado" value={selectedTask.status} valueClassName={taskStatusClass[selectedTask.status]} />
                  <DetailBox label="ETA" value={selectedTask.eta} />
                  <DetailBox label="Creada" value={selectedTask.createdAt} />
                  <DetailBox label="Scope" value={selectedTask.scope} />
                  <DetailBox label="Siguiente paso" value={selectedTask.nextStep} />
                </div>

                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Contexto</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedTask.detail}</p>
                </div>

                {selectedTask.blockedBy && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-rose-300">Bloqueo</p>
                    <p className="mt-2 text-sm text-rose-200/90">{selectedTask.blockedBy}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  note: string;
}) => (
  <Card className="border-border bg-background/40">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const DetailBox = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="rounded-xl border border-border bg-background/50 p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("mt-2 text-sm font-medium text-foreground", valueClassName)}>{value}</p>
  </div>
);

export default OpenClaw;
