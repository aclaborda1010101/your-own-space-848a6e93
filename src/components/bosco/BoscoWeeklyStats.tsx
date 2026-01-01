import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Target, Flame, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { BoscoActivity } from "@/hooks/useBosco";

interface BoscoWeeklyStatsProps {
  activities: BoscoActivity[];
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  juego_vinculo: "Juego & Vínculo",
  lectura: "Lectura",
  ingles_ludico: "Inglés Lúdico",
  ia_ninos: "IA para Niños",
  movimiento: "Movimiento",
  cierre_dia: "Cierre del Día",
};

export function BoscoWeeklyStats({ activities }: BoscoWeeklyStatsProps) {
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const weekActivities = activities.filter(a => {
      const actDate = parseISO(a.completed_at || a.date);
      return isWithinInterval(actDate, { start: weekStart, end: weekEnd });
    });

    // Total time
    const totalMinutes = weekActivities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Activity types count
    const typeCounts: Record<string, number> = {};
    weekActivities.forEach(a => {
      typeCounts[a.activity_type] = (typeCounts[a.activity_type] || 0) + 1;
    });

    // Sort by count
    const sortedTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Daily breakdown
    const dailyMinutes: Record<string, number> = {};
    weekActivities.forEach(a => {
      const day = a.completed_at 
        ? format(parseISO(a.completed_at), 'EEEE', { locale: es })
        : format(parseISO(a.date), 'EEEE', { locale: es });
      dailyMinutes[day] = (dailyMinutes[day] || 0) + (a.duration_minutes || 0);
    });

    // Find best day
    const bestDay = Object.entries(dailyMinutes)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalActivities: weekActivities.length,
      totalTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      topTypes: sortedTypes,
      bestDay: bestDay ? { day: bestDay[0], minutes: bestDay[1] } : null,
      weekRange: `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM', { locale: es })}`,
    };
  }, [activities]);

  if (weeklyStats.totalActivities === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Resumen Semanal
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {weeklyStats.weekRange}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Total activities */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{weeklyStats.totalActivities}</p>
              <p className="text-xs text-muted-foreground">Actividades</p>
            </div>
          </div>

          {/* Total time */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{weeklyStats.totalTime}</p>
              <p className="text-xs text-muted-foreground">Tiempo total</p>
            </div>
          </div>
        </div>

        {/* Top activity types */}
        {weeklyStats.topTypes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tipos más frecuentes</p>
            <div className="flex flex-wrap gap-2">
              {weeklyStats.topTypes.map(([type, count]) => (
                <Badge key={type} variant="secondary" className="gap-1">
                  <span>{ACTIVITY_TYPE_LABELS[type] || type}</span>
                  <span className="text-primary font-bold">×{count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Best day */}
        {weeklyStats.bestDay && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-sm">
              Mejor día: <span className="font-medium capitalize">{weeklyStats.bestDay.day}</span>
              <span className="text-muted-foreground"> ({weeklyStats.bestDay.minutes} min)</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
