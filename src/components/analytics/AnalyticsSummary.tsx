import { Card, CardContent } from "@/components/ui/card";
import { Zap, Target, Scale, TrendingUp } from "lucide-react";
import type { DailyMetric, ProductivityMetric, BalanceMetric } from "@/hooks/useAnalytics";

interface AnalyticsSummaryProps {
  dailyMetrics: DailyMetric[];
  productivityMetrics: ProductivityMetric[];
  balanceMetrics: BalanceMetric[];
}

export const AnalyticsSummary = ({ 
  dailyMetrics, 
  productivityMetrics, 
  balanceMetrics 
}: AnalyticsSummaryProps) => {
  // Calculate averages
  const avgEnergy = dailyMetrics.length > 0
    ? Math.round(dailyMetrics.reduce((acc, d) => acc + (d.energy || 0), 0) / dailyMetrics.filter(d => d.energy !== null).length) || 0
    : 0;

  const avgMood = dailyMetrics.length > 0
    ? Math.round(dailyMetrics.reduce((acc, d) => acc + (d.mood || 0), 0) / dailyMetrics.filter(d => d.mood !== null).length) || 0
    : 0;

  const avgCompletionRate = productivityMetrics.length > 0
    ? Math.round(productivityMetrics.reduce((acc, p) => acc + p.completionRate, 0) / productivityMetrics.length)
    : 0;

  const totalWorkTasks = balanceMetrics.reduce((acc, b) => acc + b.workTasks, 0);
  const totalLifeTasks = balanceMetrics.reduce((acc, b) => acc + b.lifeTasks, 0);
  const total = totalWorkTasks + totalLifeTasks;
  const workPercentage = total > 0 ? Math.round((totalWorkTasks / total) * 100) : 50;

  const summaryCards = [
    {
      title: "Energía Promedio",
      value: `${avgEnergy}/10`,
      icon: Zap,
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: avgEnergy >= 7 ? "Excelente nivel" : avgEnergy >= 5 ? "Nivel aceptable" : "Necesitas descanso",
    },
    {
      title: "Ánimo Promedio",
      value: `${avgMood}/10`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
      description: avgMood >= 7 ? "Muy positivo" : avgMood >= 5 ? "Estable" : "Considera pausas",
    },
    {
      title: "Tasa de Completitud",
      value: `${avgCompletionRate}%`,
      icon: Target,
      color: "text-primary",
      bgColor: "bg-primary/10",
      description: avgCompletionRate >= 80 ? "¡Excelente!" : avgCompletionRate >= 60 ? "Buen ritmo" : "Ajusta expectativas",
    },
    {
      title: "Balance Trabajo/Vida",
      value: `${workPercentage}/${100 - workPercentage}`,
      icon: Scale,
      color: "text-info",
      bgColor: "bg-info/10",
      description: Math.abs(workPercentage - 50) <= 20 ? "Bien equilibrado" : workPercentage > 70 ? "Más enfoque en vida" : "Más enfoque en trabajo",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
