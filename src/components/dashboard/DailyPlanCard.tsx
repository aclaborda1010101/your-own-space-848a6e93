import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  Briefcase, 
  Heart, 
  Users, 
  Coffee, 
  Sparkles,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock
} from "lucide-react";
import { DailyPlan, TimeBlock } from "@/hooks/useJarvisCore";
import { Skeleton } from "@/components/ui/skeleton";

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  loading: boolean;
  onRefresh: () => void;
}

const typeConfig = {
  work: { 
    icon: Briefcase, 
    color: "bg-primary/10 text-primary border-primary/20",
    label: "Trabajo"
  },
  life: { 
    icon: Brain, 
    color: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    label: "Vida"
  },
  health: { 
    icon: Heart, 
    color: "bg-success/10 text-success border-success/20",
    label: "Salud"
  },
  family: { 
    icon: Users, 
    color: "bg-warning/10 text-warning border-warning/20",
    label: "Familia"
  },
  rest: { 
    icon: Coffee, 
    color: "bg-muted text-muted-foreground border-border",
    label: "Descanso"
  },
};

const capacityColors = {
  alta: "bg-success/20 text-success border-success/30",
  media: "bg-warning/20 text-warning border-warning/30",
  baja: "bg-destructive/20 text-destructive border-destructive/30",
};

export const DailyPlanCard = ({ plan, loading, onRefresh }: DailyPlanCardProps) => {
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
          <Skeleton className="h-20 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
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
            Plan del Día
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
                JARVIS generará tu plan diario optimizado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
            Plan del Día
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
      <CardContent className="space-y-6">
        {/* Greeting & Analysis */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <p className="text-foreground font-medium">{plan.greeting}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={capacityColors[plan.analysis.capacityLevel]}>
              Capacidad {plan.analysis.capacityLevel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{plan.analysis.recommendation}</p>
        </div>

        {/* Warnings */}
        {plan.analysis.warnings.length > 0 && (
          <div className="space-y-2">
            {plan.analysis.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-warning">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Time Blocks */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Bloques de tiempo
          </h4>
          {plan.timeBlocks.map((block, index) => {
            const config = typeConfig[block.type] || typeConfig.work;
            const TypeIcon = config.icon;
            
            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:border-primary/30 ${
                  block.priority === "high" 
                    ? "border-primary/30 bg-primary/5" 
                    : "border-border"
                }`}
              >
                <div className="w-16 text-center flex-shrink-0">
                  <p className="text-sm font-mono font-medium text-foreground">{block.time}</p>
                  <p className="text-xs text-muted-foreground">{block.endTime}</p>
                </div>
                
                <div className={`w-0.5 h-12 rounded-full ${
                  block.priority === "high" ? "bg-primary" : "bg-border"
                }`} />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{block.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{block.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-xs ${config.color}`}>
                      <TypeIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                    {block.isFlexible && (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        Flexible
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        {plan.tips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              Consejos del día
            </h4>
            <ul className="space-y-2">
              {plan.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evening Reflection */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground italic">
            💭 Reflexión del día: {plan.eveningReflection}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
