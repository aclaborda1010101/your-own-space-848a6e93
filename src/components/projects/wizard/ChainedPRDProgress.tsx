import { Check, Loader2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

export type ChainedPhase = "idle" | "alcance" | "auditoria" | "patrones" | "prd" | "done" | "error";

export interface PrdSubProgress {
  currentPart: number;
  totalParts: number;
  label: string;
  partsCompleted: string[];
  startedAt: string;
}

interface Props {
  currentPhase: ChainedPhase;
  error?: string;
  prdSubProgress?: PrdSubProgress | null;
}

const PHASES = [
  { key: "alcance" as const, label: "Generando Documento de Alcance" },
  { key: "auditoria" as const, label: "Ejecutando Auditoría IA" },
  { key: "prd" as const, label: "Generando PRD Técnico" },
];

const phaseOrder: Record<string, number> = { idle: -1, alcance: 0, auditoria: 1, prd: 2, done: 3, error: -1 };

function useElapsedTime(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const start = new Date(startedAt).getTime();
    if (isNaN(start)) return;
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const ChainedPRDProgress = ({ currentPhase, error, prdSubProgress }: Props) => {
  const currentIdx = phaseOrder[currentPhase] ?? -1;
  const elapsed = useElapsedTime(prdSubProgress?.startedAt);

  // Estimate ETA: ~45s per part average for parts 1-3 (parallel), ~60s each for 4-6
  const avgSecondsPerPart = 50;
  const completedParts = prdSubProgress?.partsCompleted?.length || 0;
  const totalParts = prdSubProgress?.totalParts || 6;
  const estimatedTotal = totalParts * avgSecondsPerPart;
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
  const subProgressPct = totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;

  return (
    <div className="space-y-3 py-6">
      <div className="flex flex-col items-center gap-1 mb-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-foreground mt-2">Generando PRD completo...</p>
        <p className="text-xs text-muted-foreground">Este proceso encadena 3 fases internamente</p>
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        {PHASES.map((phase, idx) => {
          const isCompleted = currentIdx > idx;
          const isActive = currentIdx === idx;
          const isPending = currentIdx < idx;

          return (
            <div key={phase.key}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all",
                  isActive && "bg-primary/10 border border-primary/20",
                  isCompleted && "bg-muted/30",
                  isPending && "opacity-40"
                )}
              >
                <div className="shrink-0">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    </div>
                  ) : isActive ? (
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center">
                      <Circle className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-sm",
                  isActive && "font-medium text-primary",
                  isCompleted && "text-muted-foreground line-through",
                  isPending && "text-muted-foreground"
                )}>
                  {phase.label}
                </span>
              </div>

              {/* Sub-progress for PRD phase */}
              {phase.key === "prd" && isActive && prdSubProgress && (
                <div className="mt-2 mx-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      Parte {completedParts}/{totalParts}: {prdSubProgress.label}
                    </span>
                  </div>
                  <Progress value={subProgressPct} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(elapsed)} transcurrido</span>
                    </div>
                    {estimatedRemaining > 0 && (
                      <span>~{formatTime(estimatedRemaining)} restante</span>
                    )}
                  </div>
                  {prdSubProgress.partsCompleted.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prdSubProgress.partsCompleted.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5" />
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center mt-3">{error}</p>
      )}
    </div>
  );
};
