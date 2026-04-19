import { useMemo } from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { useWhoopHistory } from "@/hooks/useWhoopHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const chartConfig = {
  recovery: { label: "Recuperación %", color: "hsl(var(--success))" },
  hrv: { label: "HRV (ms)", color: "hsl(var(--primary))" },
};

/**
 * Tendencia 7d de Recovery + HRV con indicador de dirección.
 * Pensada para /health.
 */
export function RecoveryTrendChart() {
  const { history, isLoading } = useWhoopHistory(7);

  const chartData = useMemo(
    () =>
      (history || [])
        .filter(d => d.recovery_score != null || d.hrv != null)
        .map(d => ({
          date: new Date(d.data_date).toLocaleDateString("es-ES", { weekday: "short" }),
          recovery: d.recovery_score,
          hrv: d.hrv,
        })),
    [history],
  );

  const trend = useMemo(() => {
    const recoveries = chartData.map(d => d.recovery).filter((v): v is number => v != null);
    if (recoveries.length < 3) return { dir: "flat" as const, delta: 0 };
    const first = recoveries.slice(0, Math.ceil(recoveries.length / 2));
    const second = recoveries.slice(Math.floor(recoveries.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
    const delta = Math.round(avgSecond - avgFirst);
    if (delta > 5) return { dir: "up" as const, delta };
    if (delta < -5) return { dir: "down" as const, delta };
    return { dir: "flat" as const, delta };
  }, [chartData]);

  if (isLoading || chartData.length < 2) return null;

  const TrendIcon = trend.dir === "up" ? TrendingUp : trend.dir === "down" ? TrendingDown : Minus;
  const trendColor =
    trend.dir === "up" ? "text-success" : trend.dir === "down" ? "text-destructive" : "text-muted-foreground";
  const trendLabel =
    trend.dir === "up"
      ? "Tendencia positiva"
      : trend.dir === "down"
      ? "Tendencia negativa"
      : "Estable";

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Tendencia 7 días
          </CardTitle>
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trendLabel}
            {trend.delta !== 0 && (
              <span className="text-muted-foreground font-mono">
                ({trend.delta > 0 ? "+" : ""}
                {trend.delta}%)
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              className="text-[10px]"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 150]}
              tickLine={false}
              axisLine={false}
              className="text-[10px]"
            />
            <ReferenceLine
              yAxisId="left"
              y={67}
              stroke="hsl(var(--success))"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
            <ReferenceLine
              yAxisId="left"
              y={34}
              stroke="hsl(var(--warning))"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="recovery"
              stroke="var(--color-recovery)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Recuperación %"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hrv"
              stroke="var(--color-hrv)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="HRV ms"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
