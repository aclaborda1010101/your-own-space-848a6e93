import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { BalanceMetric } from "@/hooks/useAnalytics";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface BalanceChartProps {
  data: BalanceMetric[];
}

export const BalanceChart = ({ data }: BalanceChartProps) => {
  const chartData = data.map((d) => ({
    date: format(parseISO(d.date), "dd MMM", { locale: es }),
    Trabajo: d.workTasks,
    Vida: d.lifeTasks,
  }));

  if (data.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Balance Trabajo/Vida</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No hay datos de tareas completadas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Balance Trabajo/Vida</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="Trabajo" 
                stackId="1"
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary) / 0.3)"
              />
              <Area 
                type="monotone" 
                dataKey="Vida" 
                stackId="1"
                stroke="hsl(var(--success))" 
                fill="hsl(var(--success) / 0.3)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
