import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";
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
    <div className="space-y-1">
      {steps.map((step) => {
        const isActive = step.stepNumber === currentStep;
        const isCompleted = step.status === "approved";
        const isLocked = step.stepNumber > MAX_SPRINT1_STEP || step.stepNumber > maxUnlockedStep + 1;
        const isReview = step.status === "review" || step.status === "editing";
        const canClick = isCompleted || isReview || step.stepNumber <= maxUnlockedStep + 1;

        return (
          <button
            key={step.stepNumber}
            onClick={() => !isLocked && canClick && onNavigate(step.stepNumber)}
            disabled={isLocked}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
              isActive && "bg-primary/10 border border-primary/30 text-primary font-medium",
              !isActive && isCompleted && "text-foreground hover:bg-muted/50 cursor-pointer",
              !isActive && !isCompleted && !isLocked && "text-muted-foreground hover:bg-muted/30 cursor-pointer",
              isLocked && "text-muted-foreground/40 cursor-not-allowed opacity-50"
            )}
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border",
                isActive && "bg-primary text-primary-foreground border-primary",
                isCompleted && !isActive && "bg-green-500/20 text-green-400 border-green-500/40",
                isReview && !isActive && "bg-amber-500/20 text-amber-400 border-amber-500/40",
                !isActive && !isCompleted && !isReview && !isLocked && "border-border text-muted-foreground",
                isLocked && "border-border/50"
              )}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" />
              ) : isLocked ? (
                <Lock className="w-3 h-3" />
              ) : (
                step.stepNumber
              )}
            </div>
            <span className="truncate">{step.stepName}</span>
          </button>
        );
      })}
    </div>
  );
};
