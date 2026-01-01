import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { BookOpen } from "lucide-react";

interface VocabularySession {
  date: string;
  correct_count: number | null;
  total_count: number | null;
}

interface VocabularyWord {
  is_mastered: boolean;
  created_at: string;
}

interface VocabularyProgressChartProps {
  sessions: VocabularySession[];
  vocabulary: VocabularyWord[];
}

export function VocabularyProgressChart({ sessions, vocabulary }: VocabularyProgressChartProps) {
  // Group sessions by date and calculate daily stats
  const dailyStats = sessions.reduce((acc, session) => {
    const date = session.date;
    if (!acc[date]) {
      acc[date] = { correct: 0, total: 0, sessions: 0 };
    }
    acc[date].correct += session.correct_count || 0;
    acc[date].total += session.total_count || 0;
    acc[date].sessions += 1;
    return acc;
  }, {} as Record<string, { correct: number; total: number; sessions: number }>);

  // Create chart data for last 14 days
  const chartData = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const stats = dailyStats[dateStr] || { correct: 0, total: 0, sessions: 0 };
    
    chartData.push({
      date: dateStr,
      label: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      aciertos: stats.correct,
      errores: stats.total - stats.correct,
      sesiones: stats.sessions,
      precision: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    });
  }

  // Calculate cumulative mastered words over time
  const wordsByDate = vocabulary.reduce((acc, word) => {
    const date = word.created_at.split('T')[0];
    if (!acc[date]) {
      acc[date] = { total: 0, mastered: 0 };
    }
    acc[date].total += 1;
    if (word.is_mastered) {
      acc[date].mastered += 1;
    }
    return acc;
  }, {} as Record<string, { total: number; mastered: number }>);

  // Create cumulative growth data
  const growthData = [];
  let cumulativeTotal = 0;
  let cumulativeMastered = 0;
  const sortedDates = Object.keys(wordsByDate).sort();
  
  for (const date of sortedDates) {
    cumulativeTotal += wordsByDate[date].total;
    cumulativeMastered += wordsByDate[date].mastered;
    growthData.push({
      date,
      label: new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      total: cumulativeTotal,
      dominadas: cumulativeMastered
    });
  }

  const totalMastered = vocabulary.filter(w => w.is_mastered).length;
  const totalWords = vocabulary.length;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Progreso de Vocabulario - Bosco
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{totalWords} palabras</Badge>
            <Badge variant="default" className="bg-success">{totalMastered} dominadas</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sessions Performance Chart */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Rendimiento últimos 14 días</h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="label" 
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
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Legend />
                <Bar 
                  dataKey="aciertos" 
                  stackId="a" 
                  fill="hsl(var(--success))" 
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="errores" 
                  stackId="a" 
                  fill="hsl(var(--destructive))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vocabulary Growth Chart */}
        {growthData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Crecimiento del vocabulario</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="label" 
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
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    name="Total palabras"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="dominadas" 
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.3}
                    name="Dominadas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
