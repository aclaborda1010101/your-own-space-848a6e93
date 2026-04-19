import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Zap, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { OCNode, OCTask } from "@/hooks/useOpenClawHub";

interface NodeStatusCardProps {
  node: OCNode;
  tasks: OCTask[];
}

function isOnline(node: OCNode): boolean {
  if (node.status === "online" || node.status === "running") return true;
  if (!node.last_seen_at) return false;
  const ageMin = (Date.now() - new Date(node.last_seen_at).getTime()) / 60000;
  return ageMin < 5;
}

export function NodeStatusCard({ node, tasks }: NodeStatusCardProps) {
  const online = isOnline(node);
  const queueCount = tasks.filter((t) => t.status === "pending" || t.status === "running").length;
  const today = new Date().toISOString().slice(0, 10);
  const tokensToday = node.tokens_today_date === today ? node.tokens_today : 0;

  // Honestidad de datos: distinguimos lo que viene del bridge vs. lo derivado de UI/seed.
  // Mientras el bridge físico (potus-bridge) no esté conectado, marcamos como "simulated".
  const bridgeLive = Boolean(node.metadata?.bridge_live);
  const dataMode: "live" | "simulated" | "pending" = bridgeLive
    ? "live"
    : node.last_seen_at
      ? "simulated"
      : "pending";

  const tokensLabel =
    dataMode === "pending" ? "—" : tokensToday.toLocaleString();
  const tokensTotalLabel =
    dataMode === "pending" ? "—" : (node.tokens_total || 0).toLocaleString();
  const modelLabel = node.model ?? "sin asignar";
  const lastSeenLabel = node.last_seen_at
    ? formatDistanceToNow(new Date(node.last_seen_at), { addSuffix: true, locale: es })
    : "sin contacto";

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center border",
                online
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold tracking-tight">{node.name}</h3>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    online ? "bg-emerald-400 shadow-[0_0_8px_hsl(var(--success))]" : "bg-muted-foreground/40"
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">{node.host ?? "—"}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider",
              online
                ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                : "border-border text-muted-foreground"
            )}
          >
            {online ? "Online" : "Offline"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider",
              dataMode === "live"
                ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                : dataMode === "simulated"
                  ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                  : "border-border text-muted-foreground bg-muted/40"
            )}
          >
            {dataMode === "live" ? "Live" : dataMode === "simulated" ? "Simulated" : "Pending bridge"}
          </Badge>
        </div>

        {node.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Modelo</p>
            <p className="font-medium text-foreground truncate">{node.model ?? "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last seen
            </p>
            <p className="font-medium text-foreground">
              {node.last_seen_at
                ? formatDistanceToNow(new Date(node.last_seen_at), { addSuffix: true, locale: es })
                : "Nunca"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Zap className="h-3 w-3" /> Tokens hoy
            </p>
            <p className="font-medium text-foreground tabular-nums">{tokensToday.toLocaleString()}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Tokens total</p>
            <p className="font-medium text-foreground tabular-nums">
              {(node.tokens_total || 0).toLocaleString()}
            </p>
          </div>
          <div className="col-span-2 flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Activity className="h-3 w-3" /> Cola
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {queueCount} {queueCount === 1 ? "tarea" : "tareas"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
