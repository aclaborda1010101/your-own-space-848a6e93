import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Area
} from "recharts";
import { useFinanceHistory, type MonthlyComparison } from "@/hooks/useFinanceHistory";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthlyComparisonChartProps {
  onDataLoaded?: (data: MonthlyComparison[]) => void;
}

export const MonthlyComparisonChart = ({ onDataLoaded }: MonthlyComparisonChartProps) => {
  const { history, loading, fetchMonthlyHistory } = useFinanceHistory();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      fetchMonthlyHistory(6).then((data) => {
        setInitialized(true);
        onDataLoaded?.(data);
      });
    }
  }, [initialized, fetchMonthlyHistory, onDataLoaded]);

  const formatCurrency = (value: number) => `€${value.toFixed(0)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: €{entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate trends
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, direction: "neutral" as const };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 5 ? "up" : change < -5 ? "down" : ("neutral" as const),
    };
  };

  const lastMonth = history[history.length - 1];
  const previousMonth = history[history.length - 2];

  const incomeTrend = lastMonth && previousMonth 
    ? calculateTrend(lastMonth.totalIncome, previousMonth.totalIncome)
    : null;

  const expenseTrend = lastMonth && previousMonth 
    ? calculateTrend(lastMonth.totalExpenses, previousMonth.totalExpenses)
    : null;

  if (loading && !initialized) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (history.length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
          <p>No hay suficientes datos históricos para comparar</p>
          <Button variant="outline" onClick={() => fetchMonthlyHistory(6)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Cargar historial
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trend Badges */}
      <div className="flex flex-wrap gap-4">
        {incomeTrend && (
          <Card className="flex-1 min-w-[200px]">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos vs mes anterior</p>
                  <p className="text-lg font-semibold text-green-600">
                    €{lastMonth.totalIncome.toFixed(0)}
                  </p>
                </div>
                <Badge 
                  variant={incomeTrend.direction === "up" ? "default" : incomeTrend.direction === "down" ? "destructive" : "secondary"}
                  className="gap-1"
                >
                  {incomeTrend.direction === "up" && <TrendingUp className="h-3 w-3" />}
                  {incomeTrend.direction === "down" && <TrendingDown className="h-3 w-3" />}
                  {incomeTrend.direction === "neutral" && <Minus className="h-3 w-3" />}
                  {incomeTrend.value.toFixed(0)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        
        {expenseTrend && (
          <Card className="flex-1 min-w-[200px]">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Gastos vs mes anterior</p>
                  <p className="text-lg font-semibold text-red-600">
                    €{lastMonth.totalExpenses.toFixed(0)}
                  </p>
                </div>
                <Badge 
                  variant={expenseTrend.direction === "down" ? "default" : expenseTrend.direction === "up" ? "destructive" : "secondary"}
                  className="gap-1"
                >
                  {expenseTrend.direction === "up" && <TrendingUp className="h-3 w-3" />}
                  {expenseTrend.direction === "down" && <TrendingDown className="h-3 w-3" />}
                  {expenseTrend.direction === "neutral" && <Minus className="h-3 w-3" />}
                  {expenseTrend.value.toFixed(0)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {lastMonth && (
          <Card className="flex-1 min-w-[200px]">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Flujo neto este mes</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    lastMonth.netCashflow >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {lastMonth.netCashflow >= 0 ? "+" : ""}€{lastMonth.netCashflow.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Evolución Mensual</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fetchMonthlyHistory(6)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={history} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthLabel" className="text-xs" />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="netCashflow"
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary))"
                name="Flujo neto"
              />
              <Bar
                dataKey="totalIncome"
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
                name="Ingresos"
              />
              <Bar
                dataKey="totalExpenses"
                fill="hsl(0, 84%, 60%)"
                radius={[4, 4, 0, 0]}
                name="Gastos"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
