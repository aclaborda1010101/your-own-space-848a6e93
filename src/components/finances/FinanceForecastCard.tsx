import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinanceForecast } from "@/hooks/useFinanceForecast";

interface FinanceForecastCardProps {
  forecast: FinanceForecast | null;
  loading: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

export const FinanceForecastCard = ({
  forecast,
  loading,
  onGenerate,
  onClose,
}: FinanceForecastCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (!forecast && !loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <Sparkles className="h-12 w-12 text-primary/60" />
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-1">Previsión con IA</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Analiza tus patrones de gasto y obtén sugerencias personalizadas para ahorrar
            </p>
          </div>
          <Button onClick={onGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generar Previsión
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analizando tus finanzas...</p>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta": return "bg-destructive/10 text-destructive border-destructive/20";
      case "media": return "bg-warning/10 text-warning border-warning/20";
      case "baja": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-warning" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Previsión Financiera
        </CardTitle>
        <p className="text-sm text-muted-foreground">{forecast.summary}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Monthly Forecast */}
        <div>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Proyección mensual
          </h4>
          <div className="grid gap-3">
            {forecast.monthly_forecast.map((month, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{month.month}</span>
                  <Badge variant={month.projected_savings >= 0 ? "default" : "destructive"}>
                    {month.projected_savings >= 0 ? "+" : ""}
                    {formatCurrency(month.projected_savings)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    Ingresos: {formatCurrency(month.projected_income)}
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    Gastos: {formatCurrency(month.projected_expenses)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {forecast.alerts.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </h4>
            <div className="space-y-2">
              {forecast.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg text-sm",
                    alert.severity === "critical" && "bg-destructive/10",
                    alert.severity === "warning" && "bg-warning/10",
                    alert.severity === "info" && "bg-muted/50"
                  )}
                >
                  {getSeverityIcon(alert.severity)}
                  <div>
                    <span className="font-medium">{alert.category}:</span> {alert.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Savings Suggestions */}
        <div>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Sugerencias de ahorro
          </h4>
          <div className="space-y-2">
            {forecast.savings_suggestions.map((suggestion, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">{suggestion.category}</span>
                  <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                    {suggestion.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{suggestion.suggestion}</p>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingDown className="h-3 w-3" />
                  Ahorro potencial: {formatCurrency(suggestion.potential_savings)}/mes
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Expenses */}
        {forecast.recurring_expenses.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3">Gastos recurrentes identificados</h4>
            <div className="grid grid-cols-2 gap-2">
              {forecast.recurring_expenses.map((expense, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-2 text-sm">
                  <div className="font-medium">{expense.category}</div>
                  <div className="text-muted-foreground">
                    {formatCurrency(expense.amount)} / {expense.frequency}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" onClick={onGenerate} className="w-full gap-2">
          <Sparkles className="h-4 w-4" />
          Regenerar previsión
        </Button>
      </CardContent>
    </Card>
  );
};
