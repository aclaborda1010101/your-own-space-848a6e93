import { useState } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useBoscoAnalytics } from "@/hooks/useBoscoAnalytics";
import { EnergyTrendChart } from "@/components/analytics/EnergyTrendChart";
import { ProductivityChart } from "@/components/analytics/ProductivityChart";
import { BalanceChart } from "@/components/analytics/BalanceChart";
import { WeeklyOverviewChart } from "@/components/analytics/WeeklyOverviewChart";
import { AnalyticsSummary } from "@/components/analytics/AnalyticsSummary";
import { PomodoroChart } from "@/components/analytics/PomodoroChart";
import { VocabularyProgressChart } from "@/components/analytics/VocabularyProgressChart";
import { Loader2, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Analytics = () => {
  const [period, setPeriod] = useState<string>("30");
  const { loading, dailyMetrics, productivityMetrics, balanceMetrics, weeklyAverages } = useAnalytics(parseInt(period));
  const { loading: pomodoroLoading, stats: pomodoroStats } = usePomodoro(parseInt(period));
  const { sessions: boscoSessions, vocabulary: boscoVocabulary, loading: boscoLoading } = useBoscoAnalytics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análisis</h1>
          <p className="text-muted-foreground text-sm">
            Tendencias de energía, productividad y balance
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="14">Últimos 14 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="60">Últimos 60 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <AnalyticsSummary 
        dailyMetrics={dailyMetrics} 
        productivityMetrics={productivityMetrics}
        balanceMetrics={balanceMetrics}
      />

      {/* Pomodoro Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pomodoros totales</p>
                <p className="text-2xl font-bold">{pomodoroStats.totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Timer className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiempo enfocado</p>
                <p className="text-2xl font-bold">{Math.floor(pomodoroStats.totalMinutes / 60)}h {pomodoroStats.totalMinutes % 60}m</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Timer className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promedio diario</p>
                <p className="text-2xl font-bold">
                  {pomodoroStats.byDay.length > 0 
                    ? Math.round(pomodoroStats.totalSessions / pomodoroStats.byDay.length * 10) / 10
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnergyTrendChart data={dailyMetrics} />
        <ProductivityChart data={productivityMetrics} />
        <PomodoroChart data={pomodoroStats.byDay} />
        <BalanceChart data={balanceMetrics} />
        <WeeklyOverviewChart data={weeklyAverages} />
        <VocabularyProgressChart 
          sessions={boscoSessions} 
          vocabulary={boscoVocabulary} 
        />
      </div>
    </div>
  );
};

export default Analytics;
