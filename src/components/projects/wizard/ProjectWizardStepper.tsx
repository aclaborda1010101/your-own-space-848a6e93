import { cn } from "@/lib/utils";
import { Check, Lock, ChevronRight } from "lucide-react";
import type { StepStatus } from "@/hooks/useProjectWizard";

interface Props {
  steps: { stepNumber: number; stepName: string; status: StepStatus }[];
  currentStep: number;
  onNavigate: (step: number) => void;
  maxUnlockedStep: number;
}

const MAX_SPRINT1_STEP = 3;

export const ProjectWizardStepper = ({ steps, currentStep, onNavigate, maxUnlockedStep }: Props) => {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest px-3 mb-2">
        Pipeline
      </p>
      {steps.map((step, index) => {
        const isActive = step.stepNumber === currentStep;
        const isCompleted = step.status === "approved";
        const isLocked = step.stepNumber > MAX_SPRINT1_STEP || step.stepNumber > maxUnlockedStep + 1;
        const isReview = step.status === "review" || step.status === "editing";
        const canClick = isCompleted || isReview || step.stepNumber <= maxUnlockedStep + 1;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.stepNumber} className="relative">
            <button
              onClick={() => !isLocked && canClick && onNavigate(step.stepNumber)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm group",
                isActive && "bg-primary/10 text-primary font-semibold",
                !isActive && isCompleted && "text-foreground hover:bg-muted/40 cursor-pointer",
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

              <span className="truncate flex-1">{step.stepName}</span>

              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              )}
            </button>

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
