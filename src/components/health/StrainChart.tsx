import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import type { WhoopDayData } from "@/hooks/useWhoopHistory";

const chartConfig = {
  strain: { label: "Strain", color: "hsl(var(--destructive))" },
};

export const StrainChart = ({ data }: { data: WhoopDayData[] }) => {
  const chartData = data
    .filter(d => d.strain != null)
    .map(d => ({
      date: new Date(d.data_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      strain: Number(d.strain!.toFixed(1)),
    }));

  if (chartData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
        <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 21]} tickLine={false} axisLine={false} className="text-[10px]" />
        <ReferenceLine y={14} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="strain" fill="var(--color-strain)" radius={[4, 4, 0, 0]} opacity={0.8} />
      </BarChart>
    </ChartContainer>
  );
};
