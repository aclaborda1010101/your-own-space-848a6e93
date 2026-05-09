import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Power, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SwitchRow {
  operation: string;
  paused: boolean;
  max_per_hour: number | null;
  notes: string | null;
  updated_at: string;
}

export function AIKillSwitchPanel({ knownOperations }: { knownOperations: string[] }) {
  const qc = useQueryClient();
  const [newOp, setNewOp] = useState("");
  const [newMax, setNewMax] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ai_kill_switch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_kill_switch")
        .select("*")
        .order("operation", { ascending: true });
      if (error) throw error;
      return (data || []) as SwitchRow[];
    },
    refetchInterval: 30_000,
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<SwitchRow> & { operation: string }) => {
      const { error } = await supabase.functions.invoke("ai-kill-switch-admin", {
        body: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_kill_switch"] });
      toast.success("Configuración actualizada");
    },
    onError: (err) => toast.error(`Error: ${err instanceof Error ? err.message : "unknown"}`),
  });

  const globalRow = rows.find((r) => r.operation === "*");
  const others = rows.filter((r) => r.operation !== "*");

  const opSuggestions = knownOperations
    .filter((op) => !rows.some((r) => r.operation === op))
    .slice(0, 20);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Control de gasto IA</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Pausa operaciones desbocadas o pon límites por hora
          </span>
        </div>

        {/* Global emergency switch */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${globalRow?.paused ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium text-foreground">Pausa global de emergencia</p>
              <p className="text-xs text-muted-foreground">
                Cuando está activa, TODAS las llamadas a IA fallan con AI_PAUSED.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={!!globalRow?.paused}
              onCheckedChange={(v) =>
                upsert.mutate({
                  operation: "*",
                  paused: v,
                  notes: globalRow?.notes ?? "Interruptor global de emergencia",
                })
              }
            />
          )}
        </div>

        {/* Per-operation switches */}
        {others.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Operaciones controladas</p>
            {others.map((r) => (
              <div key={r.operation} className="flex items-center gap-2 p-2 rounded-md bg-background border border-border/60">
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  {r.operation}
                </Badge>
                <div className="flex items-center gap-2 ml-auto">
                  <Input
                    type="number"
                    min={0}
                    placeholder="máx/h"
                    defaultValue={r.max_per_hour ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== r.max_per_hour) {
                        upsert.mutate({ operation: r.operation, paused: r.paused, max_per_hour: v });
                      }
                    }}
                    className="h-7 w-20 text-xs"
                  />
                  <Switch
                    checked={r.paused}
                    onCheckedChange={(v) =>
                      upsert.mutate({ operation: r.operation, paused: v, max_per_hour: r.max_per_hour })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      upsert.mutate({ operation: r.operation, paused: false, max_per_hour: null })
                    }
                    title="Quitar control (vuelve a permitir sin límite)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new operation */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <select
            value={newOp}
            onChange={(e) => setNewOp(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 min-w-0"
          >
            <option value="">Selecciona operación a controlar…</option>
            {opSuggestions.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="máx/hora (opcional)"
            value={newMax}
            onChange={(e) => setNewMax(e.target.value)}
            className="h-8 w-32 text-xs"
          />
          <Button
            size="sm"
            disabled={!newOp || upsert.isPending}
            onClick={() => {
              upsert.mutate({
                operation: newOp,
                paused: false,
                max_per_hour: newMax ? Number(newMax) : null,
              });
              setNewOp("");
              setNewMax("");
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Añadir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
