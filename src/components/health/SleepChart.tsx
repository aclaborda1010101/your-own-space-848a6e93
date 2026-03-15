import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { WhoopDayData } from "@/hooks/useWhoopHistory";

const chartConfig = {
  sleep_hours: { label: "Horas sueño", color: "hsl(var(--primary))" },
  sleep_performance: { label: "Eficiencia %", color: "hsl(var(--accent))" },
};

export const SleepChart = ({ data }: { data: WhoopDayData[] }) => {
  const chartData = data
    .filter(d => d.sleep_hours != null || d.sleep_performance != null)
    .map(d => ({
      date: new Date(d.data_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      sleep_hours: d.sleep_hours ? Number(d.sleep_hours.toFixed(1)) : null,
      sleep_performance: d.sleep_performance,
    }));

  if (chartData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
        <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
        <YAxis yAxisId="hours" orientation="left" domain={[0, 12]} tickLine={false} axisLine={false} className="text-[10px]" />
        <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} className="text-[10px]" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar yAxisId="hours" dataKey="sleep_hours" fill="var(--color-sleep_hours)" radius={[4, 4, 0, 0]} opacity={0.7} />
        <Line yAxisId="pct" type="monotone" dataKey="sleep_performance" stroke="var(--color-sleep_performance)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartContainer>
  );
};
