import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface JarvisWhoopData {
  recovery_score: number | null;
  hrv: number | null;
  strain: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  sleep_performance: number | null;
  data_date: string;
  synced_at: string;
}

// Accept any row that has at least ONE non-null metric.
// Previous version filtered out strain ≤ 0.5 which discarded valid rest-day rows.
const hasMetrics = (row: any) =>
  row && (
    row.recovery_score != null ||
    row.hrv != null ||
    row.sleep_hours != null ||
    row.sleep_performance != null ||
    row.strain != null ||
    row.resting_hr != null
  );

const mapRow = (row: any, syncedField: string): JarvisWhoopData => ({
  recovery_score: row.recovery_score ?? null,
  hrv: row.hrv ?? null,
  strain: row.strain != null ? Number(row.strain) : null,
  sleep_hours: row.sleep_hours != null ? Number(row.sleep_hours) : null,
  resting_hr: row.resting_hr ?? null,
  sleep_performance: row.sleep_performance ?? null,
  data_date: row.data_date,
  synced_at: row[syncedField] ?? row.synced_at ?? row.fetched_at ?? new Date().toISOString(),
});

export const useJarvisWhoopData = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<JarvisWhoopData | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Query both sources in parallel: jarvis_whoop_data (POTUS mirror) and whoop_data (Health page direct).
      // Pick the row with the most recent data_date that actually has metrics.
      const [jarvisRes, whoopRes] = await Promise.all([
        supabase
          .from("jarvis_whoop_data")
          .select("*")
          .eq("user_id", user.id)
          .order("data_date", { ascending: false })
          .limit(5),
        supabase
          .from("whoop_data")
          .select("*")
          .eq("user_id", user.id)
          .order("data_date", { ascending: false })
          .limit(5),
      ]);

      const jarvisRow = (jarvisRes.data || []).find(hasMetrics);
      const whoopRow = (whoopRes.data || []).find(hasMetrics);

      let chosen: JarvisWhoopData | null = null;
      if (jarvisRow && whoopRow) {
        chosen = jarvisRow.data_date >= whoopRow.data_date
          ? mapRow(jarvisRow, "synced_at")
          : mapRow(whoopRow, "fetched_at");
      } else if (jarvisRow) {
        chosen = mapRow(jarvisRow, "synced_at");
      } else if (whoopRow) {
        chosen = mapRow(whoopRow, "fetched_at");
      }

      setData(chosen);
    } catch (error) {
      console.error("Error fetching WHOOP data:", error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    hasData: data !== null,
    data,
    refetch: fetchData,
  };
};
