import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Brain, 
  Sparkles,
  RefreshCw,
  Zap,
  Shield,
  TrendingUp,
  Heart,
  Target,
  CheckCircle2,
  Calendar,
  ListTodo,
  ChevronDown
} from "lucide-react";
import { DailyPlan } from "@/hooks/useJarvisCore";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  loading: boolean;
  onRefresh: () => void;
}

const modeConfig = {
  survival: { 
    icon: Shield, 
    color: "bg-destructive/20 text-destructive border-destructive/30",
    label: "Supervivencia"
  },
  balanced: { 
    icon: Target, 
    color: "bg-primary/20 text-primary border-primary/30",
    label: "Equilibrado"
  },
  push: { 
    icon: TrendingUp, 
    color: "bg-success/20 text-success border-success/30",
    label: "Empuje"
  },
  recovery: { 
    icon: Heart, 
    color: "bg-warning/20 text-warning border-warning/30",
    label: "Recuperación"
  },
};

const capacityColors = {
  alta: "bg-success/20 text-success border-success/30",
  media: "bg-warning/20 text-warning border-warning/30",
  baja: "bg-destructive/20 text-destructive border-destructive/30",
};

interface ActionableProposal {
  text: string;
  action: () => void;
  icon: React.ElementType;
  label: string;
}

export const DailyPlanCard = ({ plan, loading, onRefresh }: DailyPlanCardProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  if (loading) {
    return (
      <div className="border border-border bg-card rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="border border-border bg-card rounded-lg">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm sm:text-base font-semibold text-foreground">Resumen del Día</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-medium">Completa tu check-in</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    JARVIS generará tu resumen diario
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  const dayModeInfo = modeConfig[plan.diagnosis?.dayMode || "balanced"];
  const DayModeIcon = dayModeInfo.icon;

  // Generate actionable proposals from the plan
  const actionableProposals: ActionableProposal[] = [];

  // Proposal for tasks
  if (plan.nextSteps?.immediate) {
    actionableProposals.push({
      text: plan.nextSteps.immediate,
      action: () => navigate("/tasks"),
      icon: ListTodo,
      label: "Ver tareas"
    });
  }

  // Proposal for calendar
  if (plan.secretaryActions && plan.secretaryActions.length > 0) {
    actionableProposals.push({
      text: plan.secretaryActions[0],
      action: () => navigate("/calendar"),
      icon: Calendar,
      label: "Ir al calendario"
    });
  }

  // Proposal for today's goal
  if (plan.nextSteps?.today) {
    actionableProposals.push({
      text: plan.nextSteps.today,
      action: () => {
        toast.success("¡Objetivo del día confirmado!", {
          description: "Mantén el foco en lo importante"
        });
      },
      icon: CheckCircle2,
      label: "Confirmar objetivo"
    });
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border bg-card rounded-lg">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:text-primary transition-colors flex-1">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center relative">
                <Sparkles className="w-4 h-4 text-primary" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-foreground">Resumen del Día</span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200 ml-auto", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground ml-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">
        {/* Summary & Diagnosis */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <p className="text-foreground font-medium">{plan.greeting}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={dayModeInfo.color}>
              <DayModeIcon className="w-3 h-3 mr-1" />
              Modo {dayModeInfo.label}
            </Badge>
            <Badge variant="outline" className={capacityColors[plan.diagnosis?.capacityLevel || "media"]}>
              Capacidad {plan.diagnosis?.capacityLevel || "media"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.diagnosis?.modeReason || plan.diagnosis?.currentState}
          </p>
        </div>

        {/* Actionable Proposals */}
        {actionableProposals.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Propuestas de JARVIS
            </h4>
            <div className="space-y-2">
              {actionableProposals.map((proposal, index) => {
                const ProposalIcon = proposal.icon;
                return (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <ProposalIcon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">{proposal.text}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={proposal.action}
                      className="ml-3 flex-shrink-0"
                    >
                      {proposal.label}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Evening Reflection */}
        {plan.nextSteps?.evening && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground italic">
              Cierre del dia: {plan.nextSteps.evening}
            </p>
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
