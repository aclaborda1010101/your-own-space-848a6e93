import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Brain, ChevronDown, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Clock, Target, Circle, Info,
} from "lucide-react";
import { toast } from "sonner";
import type { StepStatus } from "@/hooks/useProjectWizard";

interface LiveSummary {
  project_id: string;
  summary_markdown: string | null;
  status_json: any;
  updated_at: string;
}

interface WizardStepInfo {
  stepNumber: number;
  stepName: string;
  status: StepStatus;
  outputData: any;
}

interface Props {
  projectId: string;
  /** Wizard steps to compute completeness from */
  wizardSteps?: WizardStepInfo[];
  /** Internal step statuses (10, 11, 12, 300) */
  internalStepStatuses?: Record<number, StepStatus>;
}

// ── Sector definitions: what constitutes "complete" ──────────────────
interface Sector {
  id: string;
  label: string;
  /** Check function returns { done: boolean; missing: string[] } */
  check: (steps: WizardStepInfo[], internal: Record<number, StepStatus>) => { done: boolean; missing: string[] };
}

const isStepDone = (steps: WizardStepInfo[], num: number) => {
  const s = steps.find(s => s.stepNumber === num);
  return s?.status === "approved" || s?.status === "review";
};

const isInternalDone = (internal: Record<number, StepStatus>, num: number) =>
  internal[num] === "approved" || internal[num] === "review";

const SECTORS: Sector[] = [
  {
    id: "entrada",
    label: "Material de entrada",
    check: (steps) => {
      const s = steps.find(s => s.stepNumber === 1);
      const done = s?.status === "approved";
      const missing: string[] = [];
      if (!done) missing.push("Subir y confirmar material de entrada");
      else if (s?.outputData) {
        const content = s.outputData.inputContent || s.outputData;
        if (typeof content === "string" && content.length < 200) {
          missing.push("Material de entrada muy corto (<200 chars)");
        }
      }
      return { done: done && missing.length === 0, missing };
    },
  },
  {
    id: "briefing",
    label: "Briefing estructurado",
    check: (steps) => {
      const s = steps.find(s => s.stepNumber === 2);
      const done = s?.status === "approved";
      const missing: string[] = [];
      if (!done) {
        if (s?.status === "review") missing.push("Revisar y aprobar el briefing");
        else missing.push("Extraer briefing con IA");
        return { done: false, missing };
      }
      // Check briefing quality
      const b = s?.outputData;
      if (b && typeof b === "object") {
        if (!b.nombre_proyecto) missing.push("Campo 'nombre_proyecto' vacío");
        if (!b.problema_a_resolver) missing.push("Campo 'problema_a_resolver' vacío");
        if (!b.usuarios_objetivo || (Array.isArray(b.usuarios_objetivo) && b.usuarios_objetivo.length === 0))
          missing.push("Campo 'usuarios_objetivo' vacío");
        if (!b.funcionalidades_clave || (Array.isArray(b.funcionalidades_clave) && b.funcionalidades_clave.length === 0))
          missing.push("Campo 'funcionalidades_clave' vacío");
      }
      return { done: missing.length === 0, missing };
    },
  },
  {
    id: "alcance",
    label: "Documento de Alcance",
    check: (steps, internal) => {
      const done = isInternalDone(internal, 10);
      const missing: string[] = [];
      if (!done) {
        if (!isStepDone(steps, 2)) missing.push("Requiere briefing aprobado primero");
        else missing.push("Generar documento de alcance (incluido en PRD)");
      }
      return { done, missing };
    },
  },
  {
    id: "auditoria",
    label: "Auditoría IA",
    check: (steps, internal) => {
      const done = isInternalDone(internal, 11);
      const missing: string[] = [];
      if (!done) {
        if (!isInternalDone(internal, 10)) missing.push("Requiere alcance completado primero");
        else missing.push("Ejecutar auditoría IA (incluida en PRD)");
      }
      return { done, missing };
    },
  },
  {
    id: "patrones",
    label: "Detección de Patrones",
    check: (steps, internal) => {
      const done = isInternalDone(internal, 12);
      const missing: string[] = [];
      if (!done) {
        if (!isInternalDone(internal, 11)) missing.push("Requiere auditoría completada primero");
        else missing.push("Detectar patrones de alto valor (incluido en PRD)");
      }
      return { done, missing };
    },
  },
  {
    id: "prd",
    label: "PRD Técnico",
    check: (steps) => {
      const done = isStepDone(steps, 3);
      const missing: string[] = [];
      if (!done) {
        const s = steps.find(s => s.stepNumber === 3);
        if (s?.status === "review") missing.push("Revisar y aprobar el PRD");
        else if (s?.status === "generating") missing.push("PRD en generación...");
        else missing.push("Generar PRD Técnico completo");
      }
      return { done, missing };
    },
  },
  {
    id: "mvp",
    label: "Descripción MVP",
    check: (steps) => {
      const done = isStepDone(steps, 4);
      const missing: string[] = [];
      if (!done) {
        if (!isStepDone(steps, 3)) missing.push("Requiere PRD aprobado primero");
        else missing.push("Generar descripción del MVP");
      }
      return { done, missing };
    },
  },
  {
    id: "forge",
    label: "Expert Forge",
    check: (steps, internal) => {
      const done = isInternalDone(internal, 300);
      const missing: string[] = [];
      if (!done) {
        if (!isStepDone(steps, 3)) missing.push("Requiere PRD aprobado primero");
        else missing.push("Publicar en Expert Forge");
      }
      return { done, missing };
    },
  },
];

export const ProjectLiveSummaryPanel = ({ projectId, wizardSteps = [], internalStepStatuses = {} }: Props) => {
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

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

  // ── Compute sector completeness ──────────────────────────────────────
  const sectorResults = useMemo(() => {
    if (wizardSteps.length === 0) return null;

    // If PRD (step 3) is approved, mark internal sub-phases as done too
    const effectiveInternal = { ...internalStepStatuses };
    const prdDone = wizardSteps.find(s => s.stepNumber === 3);
    if (prdDone && (prdDone.status === "approved" || prdDone.status === "review")) {
      if (!effectiveInternal[10]) effectiveInternal[10] = "approved";
      if (!effectiveInternal[11]) effectiveInternal[11] = "approved";
      if (!effectiveInternal[12]) effectiveInternal[12] = "approved";
    }

    return SECTORS.map(sector => ({
      ...sector,
      result: sector.check(wizardSteps, effectiveInternal),
    }));
  }, [wizardSteps, internalStepStatuses]);

  const completedSectors = sectorResults?.filter(s => s.result.done).length ?? 0;
  const totalSectors = SECTORS.length;
  const completionPct = totalSectors > 0 ? Math.round((completedSectors / totalSectors) * 100) : 0;
  const allMissing = sectorResults?.flatMap(s => s.result.done ? [] : s.result.missing) ?? [];

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
              <Badge
                variant={completionPct === 100 ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {completionPct}%
              </Badge>
              {allMissing.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-[10px] font-semibold mb-1">Para llegar al 100%:</p>
                      <ul className="space-y-0.5">
                        {allMissing.slice(0, 8).map((m, i) => (
                          <li key={i} className="text-[10px] flex items-start gap-1">
                            <span className="text-destructive mt-0.5">•</span> {m}
                          </li>
                        ))}
                        {allMissing.length > 8 && (
                          <li className="text-[10px] text-muted-foreground">+{allMissing.length - 8} más</li>
                        )}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sentimentIcon()}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-4">

            {/* ── Sector completeness grid ────────────────────────── */}
            {sectorResults && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Completitud del proyecto
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {completedSectors}/{totalSectors} sectores
                  </span>
                </div>
                <Progress value={completionPct} className="h-1.5" />

                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {sectorResults.map(sector => (
                    <TooltipProvider key={sector.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-default ${
                              sector.result.done
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {sector.result.done ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">{sector.label}</span>
                          </div>
                        </TooltipTrigger>
                        {!sector.result.done && sector.result.missing.length > 0 && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-[10px] font-semibold mb-1">Pendiente:</p>
                            <ul className="space-y-0.5">
                              {sector.result.missing.map((m, i) => (
                                <li key={i} className="text-[10px]">• {m}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            )}

            {/* ── Existing live summary content ───────────────────── */}
            {loading && !summary ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !summary ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  No hay resumen generado aún. Registra actividad y genera el primer resumen.
                </p>
                <Button variant="outline" size="sm" className="text-xs" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                  Generar resumen
                </Button>
              </div>
            ) : (
              <>
                {status?.current_status && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Punto actual</span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{status.current_status}</p>
                  </div>
                )}

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

                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-[9px] text-muted-foreground">
                    Actualizado: {summary.updated_at ? new Date(summary.updated_at).toLocaleString("es") : "—"}
                  </span>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={handleRefresh} disabled={refreshing}>
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
