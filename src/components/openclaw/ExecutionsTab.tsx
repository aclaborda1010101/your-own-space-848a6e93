import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { OCExecution } from "@/hooks/useOpenClawHub";

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  running: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

interface Props {
  executions: OCExecution[];
}

export function ExecutionsTab({ executions }: Props) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Logs de ejecución
          </h3>
          <p className="text-xs text-muted-foreground">
            Últimas {executions.length} ejecuciones (tokens, modelo y duración por run).
          </p>
        </div>

        <ScrollArea className="h-[480px] rounded-lg border border-border/50 bg-muted/10">
          <div className="font-mono text-[11px] divide-y divide-border/30">
            {executions.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground font-sans">
                Sin ejecuciones registradas todavía.
              </div>
            )}
            {executions.map((e) => (
              <div key={e.id} className="px-3 py-2 hover:bg-muted/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">
                    {format(new Date(e.started_at), "HH:mm:ss")}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {e.node_name ?? "?"}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", STATUS_COLORS[e.status])}>
                    {e.status}
                  </Badge>
                  {e.model_used && (
                    <span className="text-muted-foreground">{e.model_used}</span>
                  )}
                  <span className="text-foreground tabular-nums ml-auto">
                    {e.tokens_used}tk
                    {e.duration_ms != null && ` · ${(e.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                </div>
                {(e.output || e.error) && (
                  <p className={cn("mt-1 text-[10px] break-all", e.error ? "text-destructive" : "text-muted-foreground")}>
                    {e.error ?? e.output}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
