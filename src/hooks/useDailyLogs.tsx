import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { getTodayLocal } from "@/lib/dateUtils";

export interface DailyLog {
  id: string;
  date: string;
  workWin: string | null;
  lifeWin: string | null;
  tomorrowAdjust: string | null;
  plannedCount: number;
  completedCount: number;
  movedCount: number;
  energyAvg: number | null;
  moodAvg: number | null;
  focusAvg: number | null;
}

export const useDailyLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getTodayLocal();

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(30);

      if (error) throw error;

      setLogs(
        data.map((log) => ({
          id: log.id,
          date: log.date,
          workWin: log.work_win,
          lifeWin: log.life_win,
          tomorrowAdjust: log.tomorrow_adjust,
          plannedCount: log.planned_count || 0,
          completedCount: log.completed_count || 0,
          movedCount: log.moved_count || 0,
          energyAvg: log.energy_avg,
          moodAvg: log.mood_avg,
          focusAvg: log.focus_avg,
        }))
      );
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      toast.error("Error al cargar logs");
    } finally {
      setLoading(false);
    }
  };

  const saveTodayLog = async (data: {
    workWin: string;
    lifeWin: string;
    tomorrowAdjust: string;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("daily_logs").upsert(
        {
          user_id: user.id,
          date: today,
          work_win: data.workWin,
          life_win: data.lifeWin,
          tomorrow_adjust: data.tomorrowAdjust,
        },
        {
          onConflict: "user_id,date",
        }
      );

      if (error) throw error;

      await fetchLogs();
      toast.success("Cierre del día guardado");
    } catch (error: any) {
      console.error("Error saving log:", error);
      toast.error("Error al guardar el cierre");
    }
  };

  const todayLog = logs.find((log) => log.date === today);
  const historicalLogs = logs.filter((log) => log.date !== today);

  return {
    logs,
    todayLog,
    historicalLogs,
    loading,
    saveTodayLog,
    refetch: fetchLogs,
  };
};
