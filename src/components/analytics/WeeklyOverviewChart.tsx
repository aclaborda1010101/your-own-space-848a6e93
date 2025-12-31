import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import type { WeeklyAverage } from "@/hooks/useAnalytics";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface WeeklyOverviewChartProps {
  data: WeeklyAverage[];
}

export const WeeklyOverviewChart = ({ data }: WeeklyOverviewChartProps) => {
  // Get the latest 4 weeks for comparison
  const recentWeeks = data.slice(-4);
  
  if (recentWeeks.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Resumen Semanal</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No hay datos semanales disponibles</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for radar chart - show metrics as dimensions
  const latestWeek = recentWeeks[recentWeeks.length - 1];
  const previousWeek = recentWeeks.length > 1 ? recentWeeks[recentWeeks.length - 2] : null;

  const radarData = [
    {
      metric: "Energía",
      actual: latestWeek?.avgEnergy || 0,
      anterior: previousWeek?.avgEnergy || 0,
      fullMark: 10,
    },
    {
      metric: "Ánimo",
      actual: latestWeek?.avgMood || 0,
      anterior: previousWeek?.avgMood || 0,
      fullMark: 10,
    },
    {
      metric: "Enfoque",
      actual: latestWeek?.avgFocus || 0,
      anterior: previousWeek?.avgFocus || 0,
      fullMark: 10,
    },
    {
      metric: "Completitud",
      actual: latestWeek ? latestWeek.avgCompletionRate / 10 : 0,
      anterior: previousWeek ? previousWeek.avgCompletionRate / 10 : 0,
      fullMark: 10,
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Resumen Semanal
          {latestWeek && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (Semana del {format(parseISO(latestWeek.week), "d MMM", { locale: es })})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid className="stroke-border/30" />
              <PolarAngleAxis 
                dataKey="metric" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 10]} 
                tick={{ fontSize: 10 }}
              />
              <Legend />
              <Radar
                name="Esta semana"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
              {previousWeek && (
                <Radar
                  name="Semana anterior"
                  dataKey="anterior"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.2}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
