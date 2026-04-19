import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, CheckCircle2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { OCNode, OCTask } from "@/hooks/useOpenClawHub";
import { NewTaskDialog } from "./NewTaskDialog";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  running: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-400",
  critical: "text-destructive",
};

interface Props {
  nodes: OCNode[];
  tasks: OCTask[];
  onCreate: any;
  onRun: (t: OCTask) => void;
  onComplete: (t: OCTask) => void;
  onDelete: (id: string) => void;
}

export function TasksTab({ nodes, tasks, onCreate, onRun, onComplete, onDelete }: Props) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Tareas</h3>
            <p className="text-xs text-muted-foreground">
              {tasks.length} en historial · {tasks.filter((t) => t.status === "pending" || t.status === "running").length} activas
            </p>
          </div>
          <NewTaskDialog nodes={nodes} onCreate={onCreate} />
        </div>

        <ScrollArea className="h-[480px] rounded-lg border border-border/50">
          <div className="divide-y divide-border/40">
            {tasks.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Sin tareas todavía. Crea la primera para empezar.
              </div>
            )}
            {tasks.map((t) => {
              const node = nodeById.get(t.node_id);
              return (
                <div key={t.id} className="p-3 sm:p-4 hover:bg-muted/30 transition flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {node?.name ?? "?"}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_COLORS[t.status])}>
                        {t.status}
                      </Badge>
                      <span className={cn("text-[10px] uppercase tracking-wider", PRIORITY_COLORS[t.priority])}>
                        {t.priority}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: es })}</span>
                      <span>·</span>
                      <span className="tabular-nums">{t.tokens_used} tokens</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.status === "pending" && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onRun(t)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {t.status === "running" && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onComplete(t)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
