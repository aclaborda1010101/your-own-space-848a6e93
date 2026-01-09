import { Brain, TrendingUp, Zap, Calendar, RefreshCw, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHabitsInsights, type HabitInsight } from "@/hooks/useHabitsInsights";
import { CollapsibleCard } from "./CollapsibleCard";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
  energy: <Zap className="h-4 w-4 text-yellow-500" />,
  productivity: <TrendingUp className="h-4 w-4 text-green-500" />,
  mood: <Sparkles className="h-4 w-4 text-purple-500" />,
  schedule: <Calendar className="h-4 w-4 text-blue-500" />,
};

const categoryLabels: Record<string, string> = {
  energy: "Energía",
  productivity: "Productividad",
  mood: "Ánimo",
  schedule: "Horarios",
};

const InsightItem = ({ 
  insight, 
  onDismiss 
}: { 
  insight: HabitInsight; 
  onDismiss: (id: string) => void;
}) => {
  const category = insight.category || "productivity";
  const confidence = insight.confidence_score || 0.5;

  return (
    <div className="group relative p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {categoryIcons[category] || <Brain className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {insight.title}
            </h4>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {Math.round(confidence * 100)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {insight.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {categoryLabels[category] || category}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {insight.insight_type === "pattern" ? "Patrón" : 
               insight.insight_type === "recommendation" ? "Recomendación" : "Correlación"}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDismiss(insight.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export const HabitsInsightsCard = () => {
  const {
    topInsights,
    currentWeekPattern,
    weeksWithData,
    isLoading,
    isAnalyzing,
    analyzeHabits,
    dismissInsight,
  } = useHabitsInsights();

  const metrics = currentWeekPattern?.metrics;

  return (
    <CollapsibleCard
      id="habits-insights"
      title="Insights de Hábitos"
      icon={<Brain className="h-4 w-4 text-primary" />}
      badge={
        topInsights.length > 0 ? (
          <Badge variant="secondary" className="text-xs">
            {topInsights.length} nuevo{topInsights.length !== 1 ? "s" : ""}
          </Badge>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Weekly Summary */}
        {metrics && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-semibold text-foreground">
                {metrics.avgEnergy?.toFixed(1) || "-"}
              </div>
              <div className="text-[10px] text-muted-foreground">Energía</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-semibold text-foreground">
                {metrics.avgFocus?.toFixed(1) || "-"}
              </div>
              <div className="text-[10px] text-muted-foreground">Enfoque</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-semibold text-primary">
                {metrics.completionRate || 0}%
              </div>
              <div className="text-[10px] text-muted-foreground">Completado</div>
            </div>
          </div>
        )}

        {/* Insights List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : topInsights.length > 0 ? (
          <div className="space-y-2">
            {topInsights.map((insight) => (
              <InsightItem 
                key={insight.id} 
                insight={insight} 
                onDismiss={dismissInsight}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin insights todavía</p>
            <p className="text-xs mt-1">
              Continúa usando la app para generar insights personalizados
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {weeksWithData} semana{weeksWithData !== 1 ? "s" : ""} de datos
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={analyzeHabits}
            disabled={isAnalyzing}
          >
            <RefreshCw className={cn("h-3 w-3", isAnalyzing && "animate-spin")} />
            {isAnalyzing ? "Analizando..." : "Analizar"}
          </Button>
        </div>
      </div>
    </CollapsibleCard>
  );
};
