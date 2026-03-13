import { useMemo, useState } from "react";
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
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
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
  Wrench,
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

const agents: AgentCardData[] = [
  {
    id: "potus",
    name: "POTUS",
    role: "Coordinador / routing",
    host: "Mac Mini M4",
    model: "Claude Sonnet 4.6",
    status: "healthy",
    load: 36,
    queue: 4,
    lastSeen: "hace 12s",
  },
  {
    id: "jarvis",
    name: "JARVIS",
    role: "Audio + comunicaciones",
    host: "LAN · 192.168.1.107",
    model: "DeepSeek v3.2",
    status: "running",
    load: 62,
    queue: 7,
    lastSeen: "stream activo",
  },
  {
    id: "atlas",
    name: "ATLAS",
    role: "Film DB + GPU",
    host: "LAN · 192.168.1.45",
    model: "Gemini Flash",
    status: "warning",
    load: 79,
    queue: 2,
    lastSeen: "hace 3m",
  },
  {
    id: "titan",
    name: "TITAN",
    role: "Frames + desarrollo",
    host: "LAN · pendiente",
    model: "Claude Sonnet 4.6",
    status: "idle",
    load: 18,
    queue: 0,
    lastSeen: "sin jobs activos",
  },
];

const tasks: TaskItem[] = [
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

const runs: RunItem[] = [
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

const health: HealthItem[] = [
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

const costByPeriod: Record<PeriodKey, CostPeriodData> = {
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

const summary = {
  activeAgents: agents.filter((agent) => ["healthy", "running", "warning"].includes(agent.status)).length,
  queuedTasks: tasks.filter((task) => task.status === "en cola" || task.status === "en curso").length,
  activeRuns: runs.filter((run) => run.status === "running" || run.status === "warning").length,
  incidents: health.filter((item) => item.status === "critical" || item.status === "warning").length,
};

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
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refrescar snapshot
            </Button>
            <Button size="sm" className="gap-2">
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

        <Card className="border-border bg-card overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  Costes IA
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vista preparada para total por periodo, tokens y reparto por modelo.
                </p>
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
              <MetricCard
                icon={Euro}
                label={`Coste total · ${periodLabels[selectedPeriod]}`}
                value={formatCurrency(costData.totalCostEur)}
                note="Suma consolidada de consumo IA"
              />
              <MetricCard
                icon={WalletCards}
                label="Coste medio / llamada"
                value={formatCurrency(costData.avgCostPerCall)}
                note={`${costData.totalCalls} llamadas registradas`}
              />
              <MetricCard
                icon={Cpu}
                label="Tokens totales"
                value={formatCompactNumber(costData.totalTokens)}
                note="Entrada + salida"
              />
              <MetricCard
                icon={Bot}
                label="Modelos activos"
                value={`${costModels.length}`}
                note="Con reparto individual visible"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-border bg-background/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Coste por modelo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {costModels.map((item) => {
                    const percentage = costData.totalCostEur > 0 ? (item.totalCostEur / costData.totalCostEur) * 100 : 0;
                    return (
                      <div key={item.model} className="rounded-xl border border-border bg-background/60 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{item.model}</p>
                              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                {item.provider}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
                              <span>IN {formatCompactNumber(item.inputTokens)}</span>
                              <span>OUT {formatCompactNumber(item.outputTokens)}</span>
                              <span>CALLS {item.calls}</span>
                            </div>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(item.totalCostEur)}</p>
                            <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% del total</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Peso en coste</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                          <Progress value={percentage} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-border bg-background/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Lectura rápida</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-medium text-foreground">Modelo dominante</p>
                    <p className="mt-1 text-muted-foreground">
                      {costModels[0].model} concentra {((costModels[0].totalCostEur / costData.totalCostEur) * 100).toFixed(1)}% del gasto en {periodLabels[selectedPeriod].toLowerCase()}.
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="font-medium text-foreground">Foco de optimización</p>
                    <p className="mt-1 text-muted-foreground">
                      Embeddings + modelos premium ya justifican estructura para alertas y topes por periodo.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 p-4 space-y-2">
                    <p className="font-medium text-foreground">Estructura ya lista para datos reales</p>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• selector día / semana / mes</li>
                      <li>• total consolidado en euros</li>
                      <li>• tokens y llamadas agregadas</li>
                      <li>• breakdown por modelo con peso relativo</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList className="grid h-auto grid-cols-2 gap-2 md:grid-cols-4">
            <TabsTrigger value="agents" className="gap-2"><Bot className="h-4 w-4" />Agentes</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2"><Workflow className="h-4 w-4" />Tareas</TabsTrigger>
            <TabsTrigger value="runs" className="gap-2"><PlayCircle className="h-4 w-4" />Runs / estado</TabsTrigger>
            <TabsTrigger value="health" className="gap-2"><ShieldCheck className="h-4 w-4" />Salud sistema</TabsTrigger>
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
                          <p className="font-medium text-foreground">{agent.model}</p>
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
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Capacidad de red
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Computo agregado</span>
                        <span className="font-medium">61%</span>
                      </div>
                      <Progress value={61} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Salud del enrutado</span>
                        <span className="font-medium">88%</span>
                      </div>
                      <Progress value={88} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Uso de contexto compartido</span>
                        <span className="font-medium">47%</span>
                      </div>
                      <Progress value={47} />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">Preparado para integración real</p>
                    <p className="text-muted-foreground">
                      La vista ya separa agentes, costes, estado operacional y backlog para conectarla a Supabase, gateway o streams websocket sin rehacer la UI.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  Backlog operativo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTask(task)}
                      className="w-full rounded-xl border border-border bg-background/40 p-4 text-left transition-colors hover:border-primary/30 hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{task.title}</p>
                            <Badge variant="outline" className={priorityClass[task.priority]}>
                              prioridad {task.priority}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>ID {task.id}</span>
                            <span>Owner {task.owner}</span>
                            <span>ETA {task.eta}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <TimerReset className={cn("h-4 w-4", taskStatusClass[task.status])} />
                            <span className={taskStatusClass[task.status]}>{task.status}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
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
