import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import type { WhoopDayData } from "@/hooks/useWhoopHistory";

const chartConfig = {
  recovery: { label: "Recuperación %", color: "hsl(var(--success))" },
};

export const RecoveryChart = ({ data }: { data: WhoopDayData[] }) => {
  const chartData = data
    .filter(d => d.recovery_score != null)
    .map(d => ({
      date: new Date(d.data_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      recovery: d.recovery_score,
    }));

  if (chartData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
        <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} className="text-[10px]" />
        <ReferenceLine y={67} stroke="hsl(var(--success))" strokeDasharray="3 3" strokeOpacity={0.5} />
        <ReferenceLine y={34} stroke="hsl(var(--warning))" strokeDasharray="3 3" strokeOpacity={0.5} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="recovery" stroke="var(--color-recovery)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
};
