import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Server, Activity, Cpu, Wifi, WifiOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHero } from "@/components/ui/PageHero";
import { useOpenClawHub } from "@/hooks/useOpenClawHub";
import { NewTaskDialog } from "@/components/openclaw/NewTaskDialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  pending: { dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground border-border", label: "pending" },
  running: { dot: "bg-primary animate-pulse", badge: "bg-primary/15 text-primary border-primary/30", label: "running" },
  done:    { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "done" },
  failed:  { dot: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30", label: "failed" },
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isLive(lastSeen: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

export default function OpenClawHub() {
  const { nodes, tasks, loading, refetch, createTask } = useOpenClawHub();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = "OpenClaw Hub | JARVIS";
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 400);
  };

  const today = new Date().toISOString().slice(0, 10);
  const onlineCount = useMemo(
    () => nodes.filter((n) => isLive(n.last_seen_at)).length,
    [nodes]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const recentTasks = tasks.slice(0, 12);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-6xl">
      <PageHero
        eyebrow="Centro de cómputo"
        eyebrowIcon={<Sparkles className="w-3 h-3" />}
        title={
          <>
            OpenClaw <span className="italic font-serif text-primary">Hub</span>
          </>
        }
        subtitle="Monitor real de POTUS y TITAN. Telemetría persistente en Supabase."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="rounded-full" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Forzar actualización
            </Button>
            <NewTaskDialog nodes={nodes} onCreate={createTask as any} />
          </div>
        }
        stats={[
          { label: "Nodos online", value: `${onlineCount}/${nodes.length}`, icon: <Server className="w-4 h-4" />, tone: "success" },
          {
            label: "Tareas activas",
            value: tasks.filter((t) => t.status === "pending" || t.status === "running").length,
            hint: `${tasks.length} totales`,
            icon: <Activity className="w-4 h-4" />,
            tone: "primary",
          },
        ]}
      />

      {/* Cards de nodos */}
      <div className="grid gap-4 md:grid-cols-2">
        {nodes.map((n) => {
          const live = isLive(n.last_seen_at);
          const tokensToday = n.tokens_today_date === today ? n.tokens_today : 0;
          return (
            <Card key={n.id} className="p-5 space-y-4 border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight">{n.name}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-mono">
                      {(n as any).role ?? "—"}
                    </Badge>
                    {!live && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        Simulado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {(n as any).ip ?? n.host ?? "sin IP"}
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-mono">
                      {(n as any).provider ?? "anthropic"}
                    </Badge>
                    <span className="text-xs font-mono text-foreground/80">{n.model ?? "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {live ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400">online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">offline</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Last seen</p>
                  <p className="font-mono">
                    {n.last_seen_at
                      ? formatDistanceToNow(new Date(n.last_seen_at), { addSuffix: true, locale: es })
                      : "nunca"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Tokens hoy</p>
                  <p className="font-mono">{tokensToday > 0 ? tokensToday.toLocaleString() : "—"}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-3 w-3" />
                    Tarea activa
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {(n as any).progress ?? 0}%
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {(n as any).active_task ?? <span className="text-muted-foreground italic font-normal">sin tarea</span>}
                </p>
                <Progress value={(n as any).progress ?? 0} className="h-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tareas recientes */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Tareas recientes
          </h3>
          <span className="text-xs text-muted-foreground font-mono">{recentTasks.length} de {tasks.length}</span>
        </div>
        {recentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            No hay tareas registradas todavía.
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {recentTasks.map((t) => {
              const node = nodes.find((n) => n.id === t.node_id);
              const logs = (t as any).logs as string | undefined;
              return (
                <div key={t.id} className="py-3 flex items-start gap-3">
                  <StatusDot status={t.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {node?.name ?? "—"} · {t.status}
                      </span>
                    </div>
                    {logs && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 font-mono">
                        {logs.slice(0, 220)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "bg-emerald-400"
      : status === "running"
      ? "bg-primary animate-pulse"
      : status === "failed"
      ? "bg-destructive"
      : "bg-muted-foreground/40";
  return <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${color}`} />;
}
