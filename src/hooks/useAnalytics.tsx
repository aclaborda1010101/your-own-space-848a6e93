import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DailyMetric {
  date: string;
  energy: number | null;
  mood: number | null;
  focus: number | null;
}

export interface ProductivityMetric {
  date: string;
  planned: number;
  completed: number;
  completionRate: number;
}

export interface BalanceMetric {
  date: string;
  workTasks: number;
  lifeTasks: number;
}

export interface WeeklyAverage {
  week: string;
  avgEnergy: number;
  avgMood: number;
  avgFocus: number;
  avgCompletionRate: number;
}

export const useAnalytics = (days: number = 30) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [productivityMetrics, setProductivityMetrics] = useState<ProductivityMetric[]>([]);
  const [balanceMetrics, setBalanceMetrics] = useState<BalanceMetric[]>([]);
  const [weeklyAverages, setWeeklyAverages] = useState<WeeklyAverage[]>([]);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, days]);

  const fetchAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      // Fetch check-ins for energy/mood/focus trends
      const { data: checkIns, error: checkInsError } = await supabase
        .from("check_ins")
        .select("date, energy, mood, focus")
        .eq("user_id", user.id)
        .gte("date", startDateStr)
        .order("date", { ascending: true });

      if (checkInsError) throw checkInsError;

      // Fetch daily logs for productivity metrics
      const { data: dailyLogs, error: logsError } = await supabase
        .from("daily_logs")
        .select("date, planned_count, completed_count, moved_count")
        .eq("user_id", user.id)
        .gte("date", startDateStr)
        .order("date", { ascending: true });

      if (logsError) throw logsError;

      // Fetch tasks for work/life balance
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("type, completed, created_at, completed_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString());

      if (tasksError) throw tasksError;

      // Process daily metrics (energy, mood, focus)
      const dailyData: DailyMetric[] = (checkIns || []).map((ci) => ({
        date: ci.date,
        energy: ci.energy,
        mood: ci.mood,
        focus: ci.focus,
      }));
      setDailyMetrics(dailyData);

      // Process productivity metrics
      const productivityData: ProductivityMetric[] = (dailyLogs || []).map((log) => ({
        date: log.date,
        planned: log.planned_count || 0,
        completed: log.completed_count || 0,
        completionRate: log.planned_count 
          ? Math.round(((log.completed_count || 0) / log.planned_count) * 100) 
          : 0,
      }));
      setProductivityMetrics(productivityData);

      // Process balance metrics by date
      const balanceByDate: Record<string, { work: number; life: number }> = {};
      (tasks || []).forEach((task) => {
        if (task.completed && task.completed_at) {
          const date = task.completed_at.split("T")[0];
          if (!balanceByDate[date]) {
            balanceByDate[date] = { work: 0, life: 0 };
          }
          if (task.type === "work") {
            balanceByDate[date].work++;
          } else {
            balanceByDate[date].life++;
          }
        }
      });

      const balanceData: BalanceMetric[] = Object.entries(balanceByDate)
        .map(([date, counts]) => ({
          date,
          workTasks: counts.work,
          lifeTasks: counts.life,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setBalanceMetrics(balanceData);

      // Calculate weekly averages
      const weeklyData: Record<string, { 
        energy: number[]; 
        mood: number[]; 
        focus: number[]; 
        completionRates: number[] 
      }> = {};

      dailyData.forEach((d) => {
        const weekStart = getWeekStart(d.date);
        if (!weeklyData[weekStart]) {
          weeklyData[weekStart] = { energy: [], mood: [], focus: [], completionRates: [] };
        }
        if (d.energy !== null) weeklyData[weekStart].energy.push(d.energy);
        if (d.mood !== null) weeklyData[weekStart].mood.push(d.mood);
        if (d.focus !== null) weeklyData[weekStart].focus.push(d.focus);
      });

      productivityData.forEach((p) => {
        const weekStart = getWeekStart(p.date);
        if (!weeklyData[weekStart]) {
          weeklyData[weekStart] = { energy: [], mood: [], focus: [], completionRates: [] };
        }
        weeklyData[weekStart].completionRates.push(p.completionRate);
      });

      const weeklyAveragesData: WeeklyAverage[] = Object.entries(weeklyData)
        .map(([week, data]) => ({
          week,
          avgEnergy: average(data.energy),
          avgMood: average(data.mood),
          avgFocus: average(data.focus),
          avgCompletionRate: average(data.completionRates),
        }))
        .sort((a, b) => a.week.localeCompare(b.week));
      setWeeklyAverages(weeklyAveragesData);

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    dailyMetrics,
    productivityMetrics,
    balanceMetrics,
    weeklyAverages,
    refetch: fetchAnalytics,
  };
};

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}
