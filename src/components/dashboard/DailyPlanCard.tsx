import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ListTodo
} from "lucide-react";
import { DailyPlan } from "@/hooks/useJarvisCore";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            Resumen del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
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
      </Card>
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center relative">
              <Sparkles className="w-4 h-4 text-primary" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
            Resumen del Día
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
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
              💭 Cierre del día: {plan.nextSteps.evening}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
