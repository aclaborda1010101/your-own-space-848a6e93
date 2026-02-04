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
      // Get the most recent WHOOP data synced by POTUS
      const { data: whoopData, error } = await supabase
        .from("jarvis_whoop_data")
        .select("*")
        .eq("user_id", user.id)
        .order("data_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (whoopData) {
        setData({
          recovery_score: whoopData.recovery_score,
          hrv: whoopData.hrv,
          strain: whoopData.strain ? Number(whoopData.strain) : null,
          sleep_hours: whoopData.sleep_hours ? Number(whoopData.sleep_hours) : null,
          resting_hr: whoopData.resting_hr,
          sleep_performance: whoopData.sleep_performance,
          data_date: whoopData.data_date,
          synced_at: whoopData.synced_at,
        });
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Error fetching WHOOP data:", error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if we have data (synced by POTUS)
  const hasData = data !== null;

  return {
    isLoading,
    hasData,
    data,
    refetch: fetchData,
  };
};
