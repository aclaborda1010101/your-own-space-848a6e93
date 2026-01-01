import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Target, Plus, TrendingUp, X } from "lucide-react";
import { useAutoSavingsGoals, type SuggestedGoal, type AutoGoalsResult } from "@/hooks/useAutoSavingsGoals";
import type { MonthlyComparison } from "@/hooks/useFinanceHistory";
import type { FinanceGoal } from "@/hooks/useFinances";
import { cn } from "@/lib/utils";

interface AutoSavingsGoalsCardProps {
  historyData: MonthlyComparison[];
  existingGoals: FinanceGoal[];
  onAddGoal: (goal: Omit<FinanceGoal, "id" | "user_id" | "created_at" | "updated_at">) => Promise<any>;
}

export const AutoSavingsGoalsCard = ({
  historyData,
  existingGoals,
  onAddGoal,
}: AutoSavingsGoalsCardProps) => {
  const { loading, suggestions, generateSuggestions, clearSuggestions } = useAutoSavingsGoals();
  const [addingGoal, setAddingGoal] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const handleGenerate = () => {
    generateSuggestions(historyData, existingGoals);
  };

  const handleAddGoal = async (goal: SuggestedGoal) => {
    setAddingGoal(goal.name);
    try {
      await onAddGoal({
        name: goal.name,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        deadline: goal.deadline,
        priority: goal.priority,
        status: "active",
      });
    } finally {
      setAddingGoal(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium": return "bg-warning/10 text-warning border-warning/20";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Alta";
      case "medium": return "Media";
      case "low": return "Baja";
      default: return priority;
    }
  };

  // Show generate button if no suggestions
  if (!suggestions && !loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <Target className="h-12 w-12 text-primary/60" />
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-1">Metas de Ahorro Automáticas</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Analiza tu historial financiero y obtén sugerencias personalizadas de metas de ahorro
            </p>
          </div>
          <Button 
            onClick={handleGenerate} 
            className="gap-2"
            disabled={historyData.length < 2}
          >
            <Sparkles className="h-4 w-4" />
            Generar Sugerencias
          </Button>
          {historyData.length < 2 && (
            <p className="text-xs text-muted-foreground">
              Se necesitan al menos 2 meses de datos
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analizando patrones de gasto...</p>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions) return null;

  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={clearSuggestions}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Metas Sugeridas por IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">{suggestions.analysis_summary}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Savings Potential */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Potencial de ahorro mensual
            </p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(suggestions.monthly_savings_potential)}
            </p>
          </div>
        </div>

        {/* Suggested Goals */}
        <div className="space-y-3">
          {suggestions.suggested_goals.map((goal, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{goal.name}</h4>
                    <Badge variant="outline" className={getPriorityColor(goal.priority)}>
                      {getPriorityLabel(goal.priority)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{goal.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCurrency(goal.target_amount)}</p>
                  {goal.deadline && (
                    <p className="text-xs text-muted-foreground">
                      Para: {new Date(goal.deadline).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 gap-2"
                onClick={() => handleAddGoal(goal)}
                disabled={addingGoal === goal.name}
              >
                {addingGoal === goal.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Añadir esta meta
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={handleGenerate} className="w-full gap-2">
          <Sparkles className="h-4 w-4" />
          Regenerar sugerencias
        </Button>
      </CardContent>
    </Card>
  );
};
