import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WhoopDayData {
  data_date: string;
  recovery_score: number | null;
  hrv: number | null;
  strain: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  sleep_performance: number | null;
}

export const useWhoopHistory = (days: number = 7) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<WhoopDayData[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }

    setIsLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("whoop_data")
        .select("data_date, recovery_score, hrv, strain, sleep_hours, resting_hr, sleep_performance")
        .eq("user_id", user.id)
        .gte("data_date", sinceStr)
        .order("data_date", { ascending: true });

      if (error) throw error;

      setHistory(
        (data || []).map((d: any) => ({
          data_date: d.data_date,
          recovery_score: d.recovery_score,
          hrv: d.hrv,
          strain: d.strain ? Number(d.strain) : null,
          sleep_hours: d.sleep_hours ? Number(d.sleep_hours) : null,
          resting_hr: d.resting_hr,
          sleep_performance: d.sleep_performance,
        }))
      );
    } catch (err) {
      console.error("Error fetching WHOOP history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, days]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { isLoading, history, refetch: fetchHistory };
};
