import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAnalytics } from "@/hooks/useAnalytics";
import { EnergyTrendChart } from "@/components/analytics/EnergyTrendChart";
import { ProductivityChart } from "@/components/analytics/ProductivityChart";
import { BalanceChart } from "@/components/analytics/BalanceChart";
import { WeeklyOverviewChart } from "@/components/analytics/WeeklyOverviewChart";
import { AnalyticsSummary } from "@/components/analytics/AnalyticsSummary";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Analytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<string>("30");
  const { loading, dailyMetrics, productivityMetrics, balanceMetrics, weeklyAverages } = useAnalytics(parseInt(period));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6">
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

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnergyTrendChart data={dailyMetrics} />
            <ProductivityChart data={productivityMetrics} />
            <BalanceChart data={balanceMetrics} />
            <WeeklyOverviewChart data={weeklyAverages} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
