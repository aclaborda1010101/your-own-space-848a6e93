import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { WhoopDayData } from "@/hooks/useWhoopHistory";

const chartConfig = {
  hrv: { label: "HRV (ms)", color: "hsl(var(--primary))" },
  resting_hr: { label: "FC Reposo (bpm)", color: "hsl(var(--destructive))" },
};

export const HrvChart = ({ data }: { data: WhoopDayData[] }) => {
  const chartData = data
    .filter(d => d.hrv != null || d.resting_hr != null)
    .map(d => ({
      date: new Date(d.data_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      hrv: d.hrv,
      resting_hr: d.resting_hr,
    }));

  if (chartData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
        <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} className="text-[10px]" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="hrv" stroke="var(--color-hrv)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="resting_hr" stroke="var(--color-resting_hr)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
};
