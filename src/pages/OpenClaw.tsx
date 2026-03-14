import { useEffect, useMemo, useState } from "react";
import OpenClawChat from "@/components/openclaw/OpenClawChat";
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
  Play,
  Pause,
  Trash2,
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

// ─── Aprobaciones pendientes ──────────────────────────────────────────────────
function ApprovalsPanel() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const { toast } = useToast();

  const getSb = async () => {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  };

  const load = async () => {
    setLoading(true);
    try {
      const sb = await getSb();
      const { data, error } = await sb
        .from('cloudbot_tasks_log')
        .select('*')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApprovals((data || []).map(row => ({
        id: row.task_id,
        title: row.title,
        command: (row.full_logs as any)?.command,
        agent: (row.full_logs as any)?.agent || row.assigned_to,
        createdAt: row.created_at,
        rowId: row.task_id,
      })));
    } catch { setApprovals([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const decide = async (taskId: string, approvalId: string, decision: 'allow-once' | 'allow-always' | 'deny') => {
    setActing(taskId + decision);
    try {
      const sb = await getSb();
      // Intentar bridge directo primero (si en red local)
      const BRIDGE = `${window.location.protocol}//${window.location.hostname}:8788`;
      let done = false;
      try {
        const res = await fetch(`${BRIDGE}/api/openclaw/approve`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: approvalId, decision }),
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) { done = true; }
      } catch {}

      if (!done) {
        // Relay vía Supabase: escribir decisión, bridge la ejecuta en 10s
        await sb.from('cloudbot_tasks_log').update({
          status: 'queued',
          full_logs: { approvalId, decision, relayedAt: new Date().toISOString() },
        }).eq('task_id', taskId);
        toast({ title: decision === 'deny' ? 'Rechazado (relay)' : 'Aprobado (relay)', description: 'El bridge ejecutará la decisión en ≤10s' });
      } else {
        toast({ title: decision === 'deny' ? 'Rechazado' : 'Aprobado', description: `Ejecutado directamente` });
      }
      // Quitar de la lista
      await sb.from('cloudbot_tasks_log').update({ status: done ? 'completed' : 'queued' }).eq('task_id', taskId);
      setApprovals(prev => prev.filter(a => a.id !== taskId));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActing(null); }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Aprobaciones pendientes
            {approvals.length > 0 && (
              <Badge variant="destructive" className="ml-1">{approvals.length}</Badge>
            )}
          </span>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Comandos que esperan aprobación de un agente. Revisa y aprueba o rechaza.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-500 opacity-60" />
            <p className="text-sm text-muted-foreground">No hay aprobaciones pendientes</p>
            <p className="text-xs text-muted-foreground">Cuando un agente necesite aprobación, aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval: any) => (
              <div key={approval.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs font-semibold text-amber-600 uppercase">Aprobación requerida</span>
                      <span className="text-xs text-muted-foreground font-mono">{approval.id?.slice(0, 8)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{approval.description || approval.command || 'Comando pendiente'}</p>
                    {approval.command && (
                      <pre className="mt-2 text-xs bg-background/60 rounded p-2 overflow-x-auto text-muted-foreground border border-border/50">
                        {approval.command}
                      </pre>
                    )}
                    {approval.agent && <p className="text-xs text-muted-foreground mt-1">Agente: {approval.agent}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!!acting}
                    onClick={() => decide(approval.id, approval.id, 'allow-once')}
                  >
                    {acting === approval.id + 'allow-once' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Aprobar una vez
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="border-emerald-500/50 text-emerald-600"
                    disabled={!!acting}
                    onClick={() => decide(approval.id, approval.id, 'allow-always')}
                  >
                    Aprobar siempre
                  </Button>
                  <Button
                    size="sm" variant="destructive"
                    disabled={!!acting}
                    onClick={() => decide(approval.id, approval.id, 'deny')}
                  >
                    {acting === approval.id + 'deny' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tareas programadas (cronjobs reales de agentes) ─────────────────────────
const NODE_LABELS: Record<string, string> = { potus: 'POTUS', titan: 'TITAN', jarvis: 'JARVIS', atlas: 'ATLAS' };

function ScheduledTasksPanel({ agents }: { agents: AgentCardData[] }) {
  const [nodes, setNodes] = useState<Record<string, { jobs: any[]; error?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const BRIDGE = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8788`
    : 'http://localhost:8788';

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BRIDGE}/api/openclaw/crons`, { cache: 'no-store' });
      if (!res.ok) throw new Error('bridge no disponible');
      const data = await res.json();
      setNodes(data.nodes || {});
    } catch {
      setNodes({});
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteCron = async (node: string, jobId: string, jobName: string) => {
    setDeleting(jobId);
    try {
      const res = await fetch(`${BRIDGE}/api/openclaw/cron/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, jobId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast({ title: 'Cron eliminado', description: `"${jobName}" eliminado de ${NODE_LABELS[node] || node}` });
      setNodes(prev => ({
        ...prev,
        [node]: { ...prev[node], jobs: (prev[node]?.jobs || []).filter(j => j.id !== jobId) }
      }));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setDeleting(null); }
  };

  const totalJobs = Object.values(nodes).reduce((acc, n) => acc + (n.jobs?.length || 0), 0);

  const statusColor = (status: string) => {
    if (status === 'ok' || status === 'success') return 'text-emerald-500';
    if (status === 'error') return 'text-destructive';
    if (status === 'running') return 'text-amber-400';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalJobs} crons activos en {Object.keys(nodes).length} nodos</p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(nodes).length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Workflow className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Bridge no disponible — conéctate a la red local para ver los crons</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(nodes).map(([nodeId, nodeData]) => (
          <Card key={nodeId} className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                {NODE_LABELS[nodeId] || nodeId}
                <Badge variant="outline" className="ml-1 text-xs">{nodeData.jobs?.length || 0} crons</Badge>
                {nodeData.error && <Badge variant="destructive" className="text-xs">{nodeData.error}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!nodeData.jobs?.length ? (
                <p className="text-sm text-muted-foreground py-2">Sin crons programados</p>
              ) : (
                <div className="space-y-2">
                  {nodeData.jobs.map((job: any) => (
                    <div key={job.id} className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 hover:border-primary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-foreground">{job.name}</p>
                          <span className="font-mono text-xs text-muted-foreground bg-background/60 border border-border/50 rounded px-1.5 py-0.5">
                            {job.schedule?.expr || job.schedule?.kind}
                          </span>
                          {job.state?.lastRunStatus && (
                            <span className={`text-xs font-medium ${statusColor(job.state.lastRunStatus)}`}>
                              {job.state.lastRunStatus}
                            </span>
                          )}
                          {!job.enabled && <Badge variant="outline" className="text-xs text-muted-foreground">desactivado</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {job.payload?.message || job.payload?.kind || ''}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {job.state?.nextRunAtMs && (
                            <span>Próximo: {new Date(job.state.nextRunAtMs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {job.state?.lastRunAtMs && (
                            <span>Último: {new Date(job.state.lastRunAtMs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {job.state?.consecutiveErrors > 0 && (
                            <span className="text-destructive">{job.state.consecutiveErrors} errores consecutivos</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive shrink-0 mt-0.5"
                        disabled={deleting === job.id}
                        onClick={() => deleteCron(nodeId, job.id, job.name)}
                        title="Eliminar cron"
                      >
                        {deleting === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

const OpenClaw = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("week");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [localTasks, setLocalTasks] = useState<TaskItem[] | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("agents");
  const [filter, setFilter] = useState<"all" | "running" | "blocked" | "closed">("all");

  const deleteTask = async (id: string) => {
    // 1. Quitar del estado local inmediatamente
    setDeletedIds(prev => { const s = new Set(prev); s.add(id); return s; });
    setLocalTasks(prev => {
      const base = prev ?? (snapshot?.tasks ?? mockTasks);
      return base.filter(t => t.id !== id);
    });
    if (selectedTask?.id === id) setSelectedTask(null);
    toast({ title: "Tarea eliminada", description: `Eliminando de Supabase…` });

    // 2. Eliminar de cloudbot_tasks_log en Supabase
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      // Intentar en cloudbot_tasks_log primero
      const { error: e1 } = await sb.from('cloudbot_tasks_log').delete().eq('task_id', id);
      // También intentar en tasks de la app
      if (e1) await sb.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id);
      toast({ title: "Tarea eliminada", description: `ID ${id.slice(0,8)} eliminada correctamente` });
    } catch (e: any) {
      toast({ title: "Eliminada localmente", description: "No se pudo sincronizar con Supabase", variant: "default" });
    }
  };
  const togglePause = (id: string) => {
    // Implementar lógica de pausa (pendiente)
    toast({ title: "Función en desarrollo", description: "Pausar/Reanudar tarea pronto disponible", variant: "default" });
  };
  const [agentModels, setAgentModels] = useState<Record<string, string>>({});

  // Normaliza nombres largos de modelo al valor corto del selector
  const normalizeModel = (model: string): string => {
    if (!model) return "deepseek-reasoner";
    const m = model.toLowerCase();
    if (m.includes("sonnet")) return "claude-sonnet-4-6";
    if (m.includes("opus")) return "claude-opus-4-6";
    if (m.includes("codex") || m.includes("gpt-5") || m.includes("5.4")) return "gpt-5.4";
    if (m.includes("deepseek") && m.includes("openrouter")) return "deepseek-reasoner-or";
    if (m.includes("deepseek")) return "deepseek-reasoner";
    if (m.includes("gemini") && m.includes("2.5") && m.includes("pro")) return "gemini-2.5-pro";
    if (m.includes("gemini") && m.includes("openrouter")) return "gemini-flash-or";
    if (m.includes("gemini") && m.includes("flash")) return "gemini-2.5-flash";
    if (m.includes("gemini")) return "gemini-2.5-flash";
    if (m.includes("qwen")) return "qwen3-coder";
    if (m.includes("openrouter/auto") || m.includes("auto")) return "openrouter-auto";
    if (m.includes("gpt")) return "gpt-5.4";
    return model;
  };

  const handleModelChange = async (agentId: string, model: string) => {
    // 1. Actualizar estado local inmediatamente
    setAgentModels(prev => ({ ...prev, [agentId]: model }));

    // Mapa de modelo corto → ID completo del modelo
    const MODEL_FULL: Record<string, string> = {
      'claude-sonnet-4-6':    'anthropic/claude-sonnet-4-6',
      'claude-opus-4-6':      'anthropic/claude-opus-4-6',
      'gpt-5.4':              'openai-codex/gpt-5.4',
      'deepseek-reasoner':    'custom-api-deepseek-com/deepseek-reasoner',
      'deepseek-reasoner-or': 'openrouter/deepseek/deepseek-r1',
      'gemini-2.5-flash':     'google/gemini-2.5-flash',
      'gemini-2.5-pro':       'google/gemini-2.5-pro',
      'gemini-flash-or':      'openrouter/google/gemini-2.5-flash',
      'qwen3-coder':          'openrouter/qwen/qwen3-coder:free',
      'openrouter-auto':      'openrouter/auto',
    };
    const fullModel = MODEL_FULL[model] || model;

    // 2. Escribir en Supabase cloudbot_nodes (siempre funciona, remoto o local)
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );
      // Obtener metadata actual y fusionar el modelo
      const { data: nodeData } = await sb
        .from('cloudbot_nodes')
        .select('metadata')
        .eq('node_id', agentId)
        .single();
      const meta = (nodeData?.metadata as any) || {};
      meta.model = fullModel;
      meta.pendingModelChange = true;
      meta.modelChangedAt = new Date().toISOString();
      const { error } = await sb
        .from('cloudbot_nodes')
        .update({ metadata: meta })
        .eq('node_id', agentId);
      if (error) throw error;
      toast({ title: "✅ Modelo aplicado", description: `${agentId.toUpperCase()} → ${model} (el bridge lo confirma en ≤30s)` });
    } catch (e: any) {
      toast({ title: "Error guardando modelo", description: e.message, variant: "destructive" });
    }

    // 3. Intentar bridge directo también (best-effort, red local)
    try {
      const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
      await fetch(`${bridgeBase}/api/openclaw/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node: agentId, model }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // bridge no alcanzable desde remoto — OK, Supabase lo gestiona
    }
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
      paused: false,
      subagents: [] as any[]
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
      paused: false,
      subagents: [] as any[]
    }));
    return [...taskItems, ...queueItems].filter(t => !deletedIds.has(t.id));
  }, [tasks, taskQueue, deletedIds]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'running':
        return unifiedTasks.filter(t => t.status === 'running' || t.status === 'en curso');
      case 'blocked':
        return unifiedTasks.filter(t => t.status === 'bloqueada');
      case 'closed':
        return unifiedTasks.filter(t => t.status === 'completed' || t.status === 'lista');
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
  const alertCount = agents.filter(a => a.status === "idle" || a.status === "critical").length + tasks.filter(t => t.status === "bloqueada").length;

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
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">OpenClaw</h1>
                  <p className="text-sm text-muted-foreground font-mono">
                    DASHBOARD OPERATIVO · agentes, costes IA, runs y backlog
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {snapshot ? `LIVE · ${new Date(snapshot.generatedAt).toLocaleTimeString()}` : "SNAPSHOT · cargando"}
                  </span>
                  <button className="relative p-2 rounded-lg hover:bg-accent" title="Notificaciones">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {alertCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                        {alertCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshSnapshot} title="Actualizar datos desde el bridge">
              <RefreshCw className={cn("h-4 w-4", loadingSnapshot && "animate-spin")} />
              Refrescar snapshot
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setActiveTab("runs"); setTimeout(() => document.getElementById("openclaw-runs")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }} title="Ver historial de runs completos">
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
          <TabsList className="flex overflow-x-auto py-1 gap-1 md:grid md:grid-cols-5 md:gap-2">
            <TabsTrigger value="agents" className="gap-1.5 whitespace-nowrap"><Bot className="h-3.5 w-3.5" />Agentes</TabsTrigger>
            <TabsTrigger value="control" className="gap-1.5 whitespace-nowrap"><PlayCircle className="h-3.5 w-3.5" />En curso</TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1.5 whitespace-nowrap"><Workflow className="h-3.5 w-3.5" />Programadas</TabsTrigger>
            <TabsTrigger value="runs" className="gap-1.5 whitespace-nowrap"><Activity className="h-3.5 w-3.5" />Runs</TabsTrigger>
            <TabsTrigger value="mission" className="gap-1.5 whitespace-nowrap"><ShieldCheck className="h-3.5 w-3.5" />Aprobaciones</TabsTrigger>
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
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide">Host</p>
                          <p className="font-medium text-foreground text-sm">{agent.host}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wide">Modelo</p>
                          <Select value={agentModels[agent.id] ?? normalizeModel(agent.model)} onValueChange={(value) => handleModelChange(agent.id, value)}>
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue placeholder="Modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claude-sonnet-4-6">⚡ Claude Sonnet 4.6</SelectItem>
                              <SelectItem value="claude-opus-4-6">🧠 Claude Opus 4.6</SelectItem>
                              <SelectItem value="gpt-5.4">🤖 GPT Codex 5.4 (OAuth)</SelectItem>
                              <SelectItem value="deepseek-reasoner">🔵 DeepSeek Reasoner (API)</SelectItem>
                              <SelectItem value="deepseek-reasoner-or">🔵 DeepSeek R1 (OpenRouter)</SelectItem>
                              <SelectItem value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Google)</SelectItem>
                              <SelectItem value="gemini-2.5-pro">🌟 Gemini 2.5 Pro (Google)</SelectItem>
                              <SelectItem value="gemini-flash-or">⚡ Gemini Flash (OpenRouter fb)</SelectItem>
                              <SelectItem value="qwen3-coder">🟠 Qwen3 Coder (OpenRouter)</SelectItem>
                              <SelectItem value="openrouter-auto">🔀 OpenRouter Auto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Carga {agent.load}%</span>
                        <span>Cola {agent.queue}</span>
                        <span>{agent.lastSeen}</span>
                      </div>
                      <div className="rounded border border-border bg-background/30 p-2 text-xs space-y-1">
                        <div className="flex items-start gap-1">
                          <span className="text-foreground font-medium shrink-0">▶</span>
                          <span className="truncate">{agent.currentWork || "Sin tarea activa"}</span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="text-muted-foreground shrink-0">↩</span>
                          <span className="truncate">{agent.lastAction || "Sin actualización"}</span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="text-muted-foreground shrink-0">⏭</span>
                          <span className="truncate">{agent.nextAction || "Esperando instrucción"}</span>
                        </div>
                      </div>
                      {/* Subagentes desplegados */}
                      {(() => {
                        const agentRuns = runs.filter(r => r.node?.toLowerCase() === agent.name.toLowerCase() || r.node?.toLowerCase() === agent.id);
                        return agentRuns.length > 0 ? (
                          <div className="rounded border border-border bg-background/30 p-2 text-xs">
                            <p className="text-foreground font-medium flex items-center gap-1.5 mb-1">
                              <Bot className="h-3 w-3 text-primary" />
                              Subagentes ({agentRuns.length})
                            </p>
                            <div className="space-y-1 max-h-20 overflow-y-auto">
                              {agentRuns.map(run => (
                                <div key={run.id} className="flex items-center justify-between">
                                  <span className="truncate text-muted-foreground">{run.flow || run.id}</span>
                                  <Badge variant="outline" className={`ml-1 shrink-0 text-[10px] px-1 ${run.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' : run.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-muted/20'}`}>
                                    {run.status === 'running' ? 'activo' : run.status === 'critical' ? 'error' : run.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded border border-border/50 bg-background/20 p-1.5 text-xs text-muted-foreground text-center">
                            Sin subagentes desplegados
                          </div>
                        );
                      })()}
                      {agent.lastBackup && (
                        <div className="rounded border border-border bg-background/30 p-2 text-xs text-muted-foreground">
                          <div>Último backup: {agent.lastBackup}</div>
                          {agent.restoreStatus && <div className="mt-0.5">Restore: {agent.restoreStatus}</div>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const loadingRestore = loadingOps[`${agent.id}-restore`];
                          const loadingRestart = loadingOps[`${agent.id}-restart`];
                          return (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => runNodeOp(agent.id, "restore")} disabled={loadingRestore}>
                                {loadingRestore && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                Recuperar
                              </Button>
                              <Button size="sm" className="h-7 text-xs" onClick={() => runNodeOp(agent.id, "restart")} disabled={loadingRestart}>
                                {loadingRestart && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                Reiniciar
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border bg-background/50 flex flex-col">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    Actividad en tiempo real
                    <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1 p-3">
                      {/* Actividad por agente desde snapshot */}
                      {agents.map(agent => (
                        <div key={agent.id} className="rounded border border-border/50 bg-background/30 p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground truncate">
                              {agent.name}
                            </span>
                            <span className={`h-1.5 w-1.5 rounded-full ml-2 flex-shrink-0 ${agent.status === 'healthy' ? 'bg-emerald-500' : agent.status === 'warning' ? 'bg-amber-500' : 'bg-destructive'}`} />
                          </div>
                          <p className="text-muted-foreground truncate mt-1">
                            {agent.currentWork && agent.currentWork !== 'Sin tarea activa' ? (
                              <><span className="text-primary">▶ </span>{agent.currentWork}</>
                            ) : (
                              <span className="italic">En espera</span>
                            )}
                          </p>
                        </div>
                      ))}
                      {/* Log de sesiones recientes */}
                      {liveLog.length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground font-medium pt-3 pb-1">Sesiones recientes</p>
                          {liveLog.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                              <span className="text-muted-foreground shrink-0 w-14">{item.timestamp}</span>
                              <span className="font-medium text-primary shrink-0 w-12">{item.agent}</span>
                              <span className="text-foreground/80 flex-1 truncate">{item.message}</span>
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
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlayCircle className="h-4 w-4 text-primary" />
                    Tareas en curso
                    <Badge variant="secondary" className="ml-2 text-xs">{tasks.length + taskQueue.length}</Badge>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {agents.filter(a => a.status === 'healthy').length}/{agents.length} agentes activos
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5" onClick={() => setFilter('all')}>Todas</Badge>
                  <Badge variant={filter === 'running' ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5" onClick={() => setFilter('running')}>En curso</Badge>
                  <Badge variant={filter === 'blocked' ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5" onClick={() => setFilter('blocked')}>Bloqueadas</Badge>
                  <Badge variant={filter === 'closed' ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5" onClick={() => setFilter('closed')}>Cerradas</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {filteredTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/30 p-6 text-center">
                    <p className="text-muted-foreground">Sin tareas en curso</p>
                    <p className="text-xs text-muted-foreground mt-1">Crea una nueva tarea o revisa las programadas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-border bg-background/40 p-3 flex items-center justify-between hover:bg-background/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">{task.title}</h4>
                            <Badge variant="outline" className={`text-xs ${priorityClass[task.priority]}`}>{task.priority}</Badge>
                            <Badge variant={task.status === 'running' ? 'default' : 'outline'} className="text-xs">{task.status}</Badge>
                            <span className="text-xs text-muted-foreground">@{task.owner}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>ID: {task.id}</span>
                            <span>ETA: {task.eta}</span>
                            <span>Progreso: {task.progress || 0}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePause(task.id)} title={task.paused ? 'Reanudar' : 'Pausar'}>
                            {task.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive-foreground hover:bg-destructive" onClick={() => deleteTask(task.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

          <TabsContent value="scheduled" className="space-y-4">
            <ScheduledTasksPanel agents={agents} />
          </TabsContent>

          <TabsContent value="mission" className="space-y-4">
            <ApprovalsPanel />
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
