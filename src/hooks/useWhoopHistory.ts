import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAbortError } from "@/lib/isAbortError";

export interface WhoopDayData {
  data_date: string;
  recovery_score: number | null;
  hrv: number | null;
  strain: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  sleep_performance: number | null;
  spo2: number | null;
  skin_temp: number | null;
  respiratory_rate: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  sleep_efficiency: number | null;
  sleep_consistency: number | null;
  sleep_latency_min: number | null;
  sleep_need_hours: number | null;
  deep_sleep_hours: number | null;
  rem_sleep_hours: number | null;
  light_sleep_hours: number | null;
  awake_hours: number | null;
  disturbances: number | null;
  time_in_bed_hours: number | null;
  time_asleep_hours: number | null;
  sleep_debt_hours: number | null;
}

const NUM = (v: any) => (v != null ? Number(v) : null);

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
        .select("data_date, recovery_score, hrv, strain, sleep_hours, resting_hr, sleep_performance, spo2, skin_temp, respiratory_rate, calories, avg_hr, max_hr, sleep_efficiency, sleep_consistency, sleep_latency_min, sleep_need_hours, deep_sleep_hours, rem_sleep_hours, light_sleep_hours, awake_hours, disturbances, time_in_bed_hours, time_asleep_hours, sleep_debt_hours")
        .eq("user_id", user.id)
        .gte("data_date", sinceStr)
        .order("data_date", { ascending: true });

      if (error) throw error;

      setHistory(
        (data || []).map((d: any) => ({
          data_date: d.data_date,
          recovery_score: d.recovery_score,
          hrv: d.hrv,
          strain: NUM(d.strain),
          sleep_hours: NUM(d.sleep_hours),
          resting_hr: d.resting_hr,
          sleep_performance: d.sleep_performance,
          spo2: NUM(d.spo2),
          skin_temp: NUM(d.skin_temp),
          respiratory_rate: NUM(d.respiratory_rate),
          calories: NUM(d.calories),
          avg_hr: d.avg_hr,
          max_hr: d.max_hr,
          sleep_efficiency: NUM(d.sleep_efficiency),
          sleep_consistency: NUM(d.sleep_consistency),
          sleep_latency_min: NUM(d.sleep_latency_min),
          sleep_need_hours: NUM(d.sleep_need_hours),
          deep_sleep_hours: NUM(d.deep_sleep_hours),
          rem_sleep_hours: NUM(d.rem_sleep_hours),
          light_sleep_hours: NUM(d.light_sleep_hours),
          awake_hours: NUM(d.awake_hours),
          disturbances: d.disturbances,
          time_in_bed_hours: NUM(d.time_in_bed_hours),
          time_asleep_hours: NUM(d.time_asleep_hours),
          sleep_debt_hours: NUM(d.sleep_debt_hours),
        }))
      );
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Error fetching WHOOP history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, days]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { isLoading, history, refetch: fetchHistory };
};
