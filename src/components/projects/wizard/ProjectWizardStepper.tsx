import { cn } from "@/lib/utils";
import { Check, Lock, ChevronRight, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { StepStatus, ChainedPhase } from "@/hooks/useProjectWizard";

/** Full pipeline phases visible in the sidebar */
export interface PipelinePhase {
  id: string;
  label: string;
  /** The UI step this phase navigates to when clicked */
  uiStep: number;
  /** DB step_number used to read status (null = derived from chainedPhase) */
  dbStep: number | null;
  /** If set, phase status is derived from chainedPhase instead of DB */
  chainedKey?: ChainedPhase;
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  { id: "entrada",     label: "Entrada",               uiStep: 1, dbStep: 1 },
  { id: "briefing",    label: "Briefing",              uiStep: 2, dbStep: 2 },
  { id: "prd",         label: "PRD Técnico",           uiStep: 3, dbStep: 3,  chainedKey: "prd" },
  { id: "presupuesto", label: "Presupuesto",           uiStep: 4, dbStep: 6 },
  { id: "propuesta",   label: "Propuesta cliente",     uiStep: 5, dbStep: 30 },
];

type PhaseVisualStatus = "completed" | "processing" | "locked" | "current" | "pending";

function derivePhaseStatus(
  phase: PipelinePhase,
  stepStatuses: Record<number, StepStatus>,
  chainedPhase: ChainedPhase,
  currentUiStep: number,
): PhaseVisualStatus {
  // Forge is special — check DB step 300
  if (phase.dbStep === 300) {
    const s = stepStatuses[300];
    if (s === "approved" || s === "review") return "completed";
    if (s === "generating" || s === "in_progress") return "processing";
    // Lock forge until PRD is approved
    const prdDone = stepStatuses[3] === "approved" || stepStatuses[5] === "approved" || stepStatuses[7] === "approved";
    return prdDone ? "pending" : "locked";
  }

  // Internal chained phases (alcance, auditoria, patrones, prd)
  if (phase.chainedKey) {
    const dbStatus = phase.dbStep ? stepStatuses[phase.dbStep] : undefined;

    // If the DB has a completed status, use it
    if (dbStatus === "approved" || dbStatus === "review") return "completed";

    // If currently generating chained PRD, derive from chainedPhase
    if (chainedPhase !== "idle" && chainedPhase !== "done" && chainedPhase !== "error") {
      const CHAIN_ORDER: ChainedPhase[] = ["alcance", "auditoria", "patrones", "prd"];
      const currentIdx = CHAIN_ORDER.indexOf(chainedPhase);
      const phaseIdx = CHAIN_ORDER.indexOf(phase.chainedKey);
      if (phaseIdx < currentIdx) return "completed";
      if (phaseIdx === currentIdx) return "processing";
      return "locked";
    }

    if (dbStatus === "generating" || dbStatus === "in_progress") return "processing";
    if ((dbStatus as string) === "error") return "pending"; // allow retry

    // If PRD (step 3) is fully done, all chained sub-phases are completed
    if (stepStatuses[3] === "approved") return "completed";

    // If briefing not approved, lock chained phases
    if (stepStatuses[2] !== "approved") return "locked";
    return "pending";
  }

  // Normal UI steps (1, 2, 4)
  const dbStatus = phase.dbStep ? stepStatuses[phase.dbStep] : undefined;
  if (dbStatus === "approved") return "completed";
  if (dbStatus === "review" || dbStatus === "editing") {
    return phase.uiStep === currentUiStep ? "current" : "completed";
  }
  if (dbStatus === "generating" || dbStatus === "in_progress") return "processing";

  // Lock logic
  if (phase.uiStep === 1) return currentUiStep === 1 ? "current" : "pending";
  if (phase.uiStep <= currentUiStep) return "current";

  // Check if previous phase is done
  const prevPhaseIdx = PIPELINE_PHASES.findIndex(p => p.id === phase.id) - 1;
  if (prevPhaseIdx >= 0) {
    const prevDb = PIPELINE_PHASES[prevPhaseIdx].dbStep;
    if (prevDb && (stepStatuses[prevDb] === "approved" || stepStatuses[prevDb] === "review")) {
      return "pending";
    }
  }
  return "locked";
}

interface Props {
  steps: { stepNumber: number; stepName: string; status: StepStatus; outputData?: any }[];
  currentStep: number;
  onNavigate: (step: number) => void;
  maxUnlockedStep: number;
  /** Current chained generation phase */
  chainedPhase?: ChainedPhase;
  /** Raw DB step statuses for internal steps (10, 11, 12, 300) */
  internalStepStatuses?: Record<number, StepStatus>;
}

const STATUS_ICONS: Record<PhaseVisualStatus, React.ReactNode> = {
  completed: <Check className="w-3.5 h-3.5" />,
  processing: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  locked: <Lock className="w-3 h-3" />,
  current: null, // will show step number
  pending: null,
};

const STATUS_EMOJI: Record<PhaseVisualStatus, string> = {
  completed: "✅",
  processing: "⏳",
  locked: "🔒",
  current: "",
  pending: "",
};

export const ProjectWizardStepper = ({
  steps,
  currentStep,
  onNavigate,
  maxUnlockedStep,
  chainedPhase = "idle",
  internalStepStatuses = {},
}: Props) => {
  // Build a combined status map from UI steps + internal steps
  const stepStatuses: Record<number, StepStatus> = { ...internalStepStatuses };
  for (const s of steps) {
    stepStatuses[s.stepNumber] = s.status;
  }

  // Calculate global progress
  const phaseStatuses = PIPELINE_PHASES.map(p => derivePhaseStatus(p, stepStatuses, chainedPhase, currentStep));
  const completedCount = phaseStatuses.filter(s => s === "completed").length;
  const processingCount = phaseStatuses.filter(s => s === "processing").length;
  const globalProgress = Math.round(((completedCount + processingCount * 0.5) / PIPELINE_PHASES.length) * 100);

  return (
    <div className="space-y-1">
      {/* Global progress */}
      <div className="px-3 mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
            Pipeline
          </p>
          <span className="text-[10px] font-mono text-primary font-bold">{globalProgress}%</span>
        </div>
        <Progress value={globalProgress} className="h-1" />
      </div>

      {/* Phase list */}
      {PIPELINE_PHASES.map((phase, index) => {
        const visualStatus = phaseStatuses[index];
        const isActive = phase.uiStep === currentStep && (visualStatus === "current" || visualStatus === "processing" || visualStatus === "pending");
        const canClick = visualStatus !== "locked";
        const isLast = index === PIPELINE_PHASES.length - 1;
        const isSubPhase = phase.chainedKey && phase.id !== "prd";

        return (
          <div key={phase.id} className="relative">
            <button
              onClick={() => canClick && onNavigate(phase.uiStep)}
              disabled={!canClick}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-sm group",
                isSubPhase && "pl-6",
                isActive && "bg-primary/10 text-primary font-semibold",
                visualStatus === "completed" && !isActive && "text-foreground hover:bg-muted/40 cursor-pointer",
                visualStatus === "processing" && !isActive && "text-primary/80 bg-primary/5",
                visualStatus === "pending" && "text-muted-foreground hover:bg-muted/30 cursor-pointer",
                visualStatus === "locked" && "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold transition-all",
                  isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                  visualStatus === "completed" && !isActive && "bg-green-500/15 text-green-500",
                  visualStatus === "processing" && !isActive && "bg-primary/15 text-primary",
                  visualStatus === "pending" && "bg-muted/50 text-muted-foreground",
                  visualStatus === "locked" && "bg-muted/20 text-muted-foreground/30"
                )}
              >
                {visualStatus === "completed" ? (
                  STATUS_ICONS.completed
                ) : visualStatus === "processing" ? (
                  STATUS_ICONS.processing
                ) : visualStatus === "locked" ? (
                  STATUS_ICONS.locked
                ) : (
                  <span className="text-[10px]">{index + 1}</span>
                )}
              </div>

              <span className={cn("truncate flex-1 text-xs", isSubPhase && "text-[11px]")}>
                {phase.label}
              </span>

              {isActive && (
                <ChevronRight className="w-3 h-3 text-primary/60 shrink-0" />
              )}
            </button>

            {/* Connector line */}
            {!isLast && (
              <div className={cn("absolute left-[20px] top-[38px] w-[2px] h-1.5", isSubPhase && "left-[32px]")}>
                <div className={cn(
                  "w-full h-full rounded-full",
                  visualStatus === "completed" ? "bg-green-500/30" : "bg-border/50"
                )} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
