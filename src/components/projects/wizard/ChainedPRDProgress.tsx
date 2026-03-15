import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChainedPhase = "idle" | "alcance" | "auditoria" | "prd" | "done" | "error";

interface Props {
  currentPhase: ChainedPhase;
  error?: string;
}

const PHASES = [
  { key: "alcance" as const, label: "Generando Documento de Alcance" },
  { key: "auditoria" as const, label: "Ejecutando Auditoría IA" },
  { key: "prd" as const, label: "Generando PRD Técnico" },
];

const phaseOrder: Record<string, number> = { idle: -1, alcance: 0, auditoria: 1, prd: 2, done: 3, error: -1 };

export const ChainedPRDProgress = ({ currentPhase, error }: Props) => {
  const currentIdx = phaseOrder[currentPhase] ?? -1;

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
            <div
              key={phase.key}
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
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center mt-3">{error}</p>
      )}
    </div>
  );
};
