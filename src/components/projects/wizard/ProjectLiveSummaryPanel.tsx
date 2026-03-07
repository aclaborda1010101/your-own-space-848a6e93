import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain, ChevronDown, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Clock, Target,
} from "lucide-react";
import { toast } from "sonner";

interface LiveSummary {
  project_id: string;
  summary_markdown: string | null;
  status_json: any;
  updated_at: string;
}

interface Props {
  projectId: string;
}

export const ProjectLiveSummaryPanel = ({ projectId }: Props) => {
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("business_project_live_summary")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (!error && data) setSummary(data);
    } catch (e) {
      console.error("Error fetching summary:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("project-activity-intelligence", {
        body: { action: "refresh_summary", projectId },
      });
      if (error) throw error;
      await fetchSummary();
      toast.success("Resumen actualizado");
    } catch (e: any) {
      console.error("Refresh error:", e);
      toast.error("Error al actualizar resumen");
    } finally {
      setRefreshing(false);
    }
  };

  const status = summary?.status_json;

  const sentimentIcon = () => {
    const s = status?.client_sentiment;
    if (s === "positive") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (s === "negative") return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Resumen vivo del proyecto</span>
              {status?.completion_pct != null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {status.completion_pct}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sentimentIcon()}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-3">
            {loading && !summary ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !summary ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  No hay resumen generado aún. Registra actividad y genera el primer resumen.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                  Generar resumen
                </Button>
              </div>
            ) : (
              <>
                {/* Current status */}
                {status?.current_status && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Punto actual</span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{status.current_status}</p>
                  </div>
                )}

                {/* Recent changes */}
                {status?.recent_changes?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cambios recientes</span>
                    {status.recent_changes.slice(0, 4).map((c: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span className="text-[11px] text-foreground">{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Risks */}
                {status?.risks_blockers?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Riesgos / Bloqueos</span>
                    {status.risks_blockers.slice(0, 3).map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                        <span className="text-[11px] text-foreground">{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Scope/PRD implications */}
                {status?.scope_prd_implications?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Implicaciones Scope/PRD</span>
                    {status.scope_prd_implications.slice(0, 3).map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span className="text-[11px] text-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Next actions */}
                {status?.next_actions?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Siguientes acciones</span>
                    {status.next_actions.slice(0, 4).map((a: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-[11px] text-foreground">{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer with refresh */}
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-[9px] text-muted-foreground">
                    Actualizado: {summary.updated_at ? new Date(summary.updated_at).toLocaleString("es") : "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-6 px-2"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    <span className="ml-1">Recalcular</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
