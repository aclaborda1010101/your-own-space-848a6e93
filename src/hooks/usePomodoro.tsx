import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PomodoroSession {
  id: string;
  task_id: string | null;
  task_title: string | null;
  duration: number;
  type: string;
  completed_at: string;
}

export interface PomodoroStats {
  totalSessions: number;
  totalMinutes: number;
  byDay: { date: string; sessions: number; minutes: number }[];
  byWeek: { week: string; sessions: number; minutes: number }[];
}

export const usePomodoro = (days: number = 30) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [stats, setStats] = useState<PomodoroStats>({
    totalSessions: 0,
    totalMinutes: 0,
    byDay: [],
    byWeek: [],
  });

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user, days]);

  const fetchSessions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("pomodoro_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "work")
        .gte("completed_at", startDate.toISOString())
        .order("completed_at", { ascending: true });

      if (error) throw error;

      setSessions(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error("Error fetching pomodoro sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: PomodoroSession[]) => {
    const totalSessions = data.length;
    const totalMinutes = data.reduce((sum, s) => sum + s.duration, 0);

    // Group by day
    const byDayMap: Record<string, { sessions: number; minutes: number }> = {};
    data.forEach((s) => {
      const date = s.completed_at.split("T")[0];
      if (!byDayMap[date]) {
        byDayMap[date] = { sessions: 0, minutes: 0 };
      }
      byDayMap[date].sessions++;
      byDayMap[date].minutes += s.duration;
    });

    const byDay = Object.entries(byDayMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by week
    const byWeekMap: Record<string, { sessions: number; minutes: number }> = {};
    data.forEach((s) => {
      const week = getWeekStart(s.completed_at.split("T")[0]);
      if (!byWeekMap[week]) {
        byWeekMap[week] = { sessions: 0, minutes: 0 };
      }
      byWeekMap[week].sessions++;
      byWeekMap[week].minutes += s.duration;
    });

    const byWeek = Object.entries(byWeekMap)
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));

    setStats({ totalSessions, totalMinutes, byDay, byWeek });
  };

  const saveSession = async (
    taskId: string | null,
    taskTitle: string | null,
    duration: number,
    type: "work" | "shortBreak" | "longBreak"
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("pomodoro_sessions").insert({
        user_id: user.id,
        task_id: taskId,
        task_title: taskTitle,
        duration,
        type,
      });

      if (error) throw error;

      // Refetch to update stats
      fetchSessions();
    } catch (error) {
      console.error("Error saving pomodoro session:", error);
    }
  };

  return {
    loading,
    sessions,
    stats,
    saveSession,
    refetch: fetchSessions,
  };
};

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}