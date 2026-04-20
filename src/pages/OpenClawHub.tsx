import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Server, Activity, Cpu, Wifi, WifiOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHero } from "@/components/ui/PageHero";
import { useOpenClawHub } from "@/hooks/useOpenClawHub";
import { NewTaskDialog } from "@/components/openclaw/NewTaskDialog";
import { TokensSparkline } from "@/components/openclaw/TokensSparkline";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  pending: { dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground border-border", label: "pending" },
  running: { dot: "bg-primary animate-pulse", badge: "bg-primary/15 text-primary border-primary/30", label: "running" },
  done:    { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "done" },
  failed:  { dot: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30", label: "failed" },
};

type LiveState = "online" | "idle" | "offline" | "unknown";

function liveState(lastSeen: string | null, nowMs: number): LiveState {
  if (!lastSeen) return "unknown";
  const ageMs = nowMs - new Date(lastSeen).getTime();
  if (ageMs < 2 * 60 * 1000) return "online";
  if (ageMs < 10 * 60 * 1000) return "idle";
  return "offline";
}

function ageLabel(lastSeen: string | null, nowMs: number): string {
  if (!lastSeen) return "sin contacto";
  const sec = Math.max(0, Math.floor((nowMs - new Date(lastSeen).getTime()) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const LIVE_STYLES: Record<LiveState, { dot: string; text: string; label: string; icon: "wifi" | "off" }> = {
  online:  { dot: "bg-emerald-400", text: "text-emerald-400", label: "online", icon: "wifi" },
  idle:    { dot: "bg-amber-400",   text: "text-amber-400",   label: "idle",   icon: "wifi" },
  offline: { dot: "bg-destructive", text: "text-destructive", label: "offline", icon: "off" },
  unknown: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "sin datos", icon: "off" },
};

export default function OpenClawHub() {
  const { nodes, tasks, executions, loading, refetch, createTask } = useOpenClawHub();
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    document.title = "OpenClaw Hub | JARVIS";
  }, []);

  // Tick cada segundo para que "hace Xs" se actualice en vivo.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 400);
  };

  const today = new Date().toISOString().slice(0, 10);
  const onlineCount = useMemo(
    () => nodes.filter((n) => liveState(n.last_seen_at, nowMs) === "online").length,
    [nodes, nowMs]
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
          const ls = liveState(n.last_seen_at, nowMs);
          const lsStyle = LIVE_STYLES[ls];
          const tokensToday = n.tokens_today_date === today ? n.tokens_today : 0;
          const isOnlineLike = ls === "online" || ls === "idle";
          return (
            <Card key={n.id} className="p-5 space-y-4 border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight">{n.name}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-mono">
                      {(n as any).role ?? "—"}
                    </Badge>
                    {(() => {
                      const bridgeLive = Boolean((n as any).metadata?.bridge_live);
                      if (bridgeLive || ls === "online") {
                        return (
                          <Badge className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            Online
                          </Badge>
                        );
                      }
                      if (ls === "unknown") {
                        return (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                            Sin datos
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {(n as any).ip ?? n.host ?? "N/A"}
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-mono">
                      {(n as any).provider ?? "anthropic"}
                    </Badge>
                    <span className="text-xs font-mono text-foreground/80">{n.model ?? "—"}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${lsStyle.dot}`} />
                    {lsStyle.icon === "wifi" ? (
                      <Wifi className={`h-4 w-4 ${lsStyle.text}`} />
                    ) : (
                      <WifiOff className={`h-4 w-4 ${lsStyle.text}`} />
                    )}
                    <span className={`text-xs font-medium ${lsStyle.text}`}>{lsStyle.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Actualizado {ageLabel(n.last_seen_at, nowMs)}
                  </span>
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

              {/* Sparkline 24h */}
              <div className="space-y-1 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Tokens · 24h</span>
                  <span className="font-mono normal-case">
                    {executions
                      .filter((e: any) => e.node_id === n.id && Date.now() - new Date(e.started_at).getTime() < 24 * 3600 * 1000)
                      .reduce((a: number, b: any) => a + (b.tokens_used || 0), 0)
                      .toLocaleString()}
                  </span>
                </div>
                <TokensSparkline executions={executions as any} nodeId={n.id} />
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
              const desc = (t as any).description as string | undefined;
              const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.pending;
              return (
                <div key={t.id} className="py-3 flex items-start gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full mt-2 shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold leading-tight truncate">{t.title}</p>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-mono shrink-0 ${st.badge}`}>
                        {st.label}
                      </Badge>
                    </div>
                    {desc && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
                    )}
                    {logs && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2 font-mono">
                        {logs.slice(0, 220)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                      {node?.name ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}
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
