import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Trash2, Repeat, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { OCNode, OCRecurring } from "@/hooks/useOpenClawHub";
import { NewRecurringDialog } from "./NewRecurringDialog";

interface Props {
  nodes: OCNode[];
  recurring: OCRecurring[];
  onCreate: any;
  onToggle: (id: string, enabled: boolean) => void;
  onExecute: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RecurringTab({ nodes, recurring, onCreate, onToggle, onExecute, onDelete }: Props) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" /> Tareas recurrentes
            </h3>
            <p className="text-xs text-muted-foreground">
              {recurring.filter((r) => r.enabled).length} activas · {recurring.length} totales
            </p>
          </div>
          <NewRecurringDialog nodes={nodes} onCreate={onCreate} />
        </div>

        <ScrollArea className="h-[480px] rounded-lg border border-border/50">
          <div className="divide-y divide-border/40">
            {recurring.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Sin programaciones. Crea la primera para automatizar tareas.
              </div>
            )}
            {recurring.map((r) => {
              const node = nodeById.get(r.node_id);
              return (
                <div key={r.id} className="p-4 flex items-start gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {node?.name ?? "?"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {r.schedule_label}
                      </Badge>
                      {r.schedule_cron && (
                        <span className="font-mono text-[10px] text-muted-foreground">{r.schedule_cron}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm text-foreground">{r.title}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Disparada {r.run_count}×</span>
                      {r.last_run_at && (
                        <>
                          <span>·</span>
                          <span>
                            última {formatDistanceToNow(new Date(r.last_run_at), { addSuffix: true, locale: es })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={r.enabled} onCheckedChange={(v) => onToggle(r.id, v)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onExecute(r.id)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(r.id)}
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
