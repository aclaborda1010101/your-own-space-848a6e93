import { cn } from "@/lib/utils";
import { Check, Lock, ChevronRight, Database } from "lucide-react";
import type { StepStatus } from "@/hooks/useProjectWizard";

interface DataSubStep {
  visible: boolean;
  active: boolean;
  complete: boolean;
}

interface Props {
  steps: { stepNumber: number; stepName: string; status: StepStatus; outputData?: any }[];
  currentStep: number;
  onNavigate: (step: number) => void;
  maxUnlockedStep: number;
  dataSubStep?: DataSubStep;
}

export const ProjectWizardStepper = ({ steps, currentStep, onNavigate, maxUnlockedStep, dataSubStep }: Props) => {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest px-3 mb-2">
        Pipeline
      </p>
      {steps.map((step, index) => {
        const isActive = step.stepNumber === currentStep;
        const isCompleted = step.status === "approved";
        const isSkipped = isCompleted && (step as any).outputData?.skipped === true;
        const isLocked = step.stepNumber > maxUnlockedStep + 1;
        const isReview = step.status === "review" || step.status === "editing";
        const canClick = !isSkipped && (isCompleted || isReview || step.stepNumber <= maxUnlockedStep + 1);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.stepNumber} className="relative">
            <button
              onClick={() => !isLocked && canClick && onNavigate(step.stepNumber)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm group",
                isActive && "bg-primary/10 text-primary font-semibold",
                isSkipped && "text-muted-foreground/40 cursor-default",
                !isActive && !isSkipped && isCompleted && "text-foreground hover:bg-muted/40 cursor-pointer",
                !isActive && !isCompleted && !isLocked && "text-muted-foreground hover:bg-muted/30 cursor-pointer",
                isLocked && "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-all",
                  isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                  isCompleted && !isActive && "bg-green-500/15 text-green-400",
                  isReview && !isActive && "bg-amber-500/15 text-amber-400",
                  !isActive && !isCompleted && !isReview && !isLocked && "bg-muted/50 text-muted-foreground",
                  isLocked && "bg-muted/20 text-muted-foreground/30"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : isLocked ? (
                  <Lock className="w-3 h-3" />
                ) : (
                  step.stepNumber
                )}
              </div>

              <span className="truncate flex-1">
                {isSkipped ? (
                  <span className="line-through opacity-50">{step.stepName}</span>
                ) : step.stepNumber === 3 ? "Borrador de Alcance" : step.stepNumber === 5 ? "Documento Final" : step.stepName}
                {isSkipped && <span className="text-[10px] ml-1 no-underline opacity-60">Omitido</span>}
              </span>

              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              )}
            </button>

            {/* Data ingestion sub-step under step 7 */}
            {step.stepNumber === 7 && dataSubStep?.visible && (
              <div className="flex items-center gap-2.5 pl-6 pr-3 py-1.5 ml-3 border-l-2 border-border/30">
                <div
                  className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all",
                    dataSubStep.complete && "bg-green-500/15 text-green-400",
                    dataSubStep.active && "bg-primary/15 text-primary",
                    !dataSubStep.complete && !dataSubStep.active && "bg-muted/30 text-muted-foreground/50"
                  )}
                >
                  {dataSubStep.complete ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Database className="w-3 h-3" />
                  )}
                </div>
                <span className={cn(
                  "text-xs truncate",
                  dataSubStep.active && "text-primary font-medium",
                  dataSubStep.complete && "text-muted-foreground",
                  !dataSubStep.active && !dataSubStep.complete && "text-muted-foreground/50"
                )}>
                  Ingesta de Datos
                </span>
                {dataSubStep.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                )}
              </div>
            )}

            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-[22px] top-[42px] w-[2px] h-2.5">
                <div className={cn(
                  "w-full h-full rounded-full",
                  isCompleted ? "bg-green-500/30" : "bg-border/50"
                )} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
