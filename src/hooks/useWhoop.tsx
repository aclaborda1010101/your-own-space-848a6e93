import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface WhoopData {
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
  data_date: string;
  fetched_at: string;
}

const NUM = (v: any) => (v != null ? Number(v) : null);

const mapRow = (d: any): WhoopData => ({
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
  data_date: d.data_date,
  fetched_at: d.fetched_at,
});

const hasWhoopMetrics = (d: any) =>
  d && (d.recovery_score != null || d.strain != null || d.sleep_hours != null || d.hrv != null || d.sleep_performance != null);

export const useWhoop = () => {
  const { user, session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [data, setData] = useState<WhoopData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const loadDateData = useCallback(async (date: Date) => {
    if (!user) return;
    const dateStr = date.toISOString().split("T")[0];

    const { data: row } = await supabase
      .from("whoop_data")
      .select("*")
      .eq("user_id", user.id)
      .eq("data_date", dateStr)
      .maybeSingle();

    if (row && hasWhoopMetrics(row)) {
      setData(mapRow(row));
      return;
    }

    // Try most recent valid day before this date (ignores empty/null rows)
    const { data: fallbackRows } = await supabase
      .from("whoop_data")
      .select("*")
      .eq("user_id", user.id)
      .lte("data_date", dateStr)
      .order("data_date", { ascending: false })
      .limit(30);

    const fallback = (fallbackRows || []).find(hasWhoopMetrics);
    setData(fallback ? mapRow(fallback) : null);
  }, [user]);

  const loadAvailableDates = useCallback(async () => {
    if (!user) return;
    const { data: dates } = await supabase
      .from("whoop_data")
      .select("data_date")
      .eq("user_id", user.id)
      .not("recovery_score", "is", null)
      .order("data_date", { ascending: false });

    if (dates) {
      setAvailableDates(dates.map((d: any) => d.data_date));
    }
  }, [user]);

  const checkConnection = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "check_connection" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setIsConnected(result.connected);
    } catch (error) {
      console.error("Error checking WHOOP connection:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  const connect = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const redirectUri = "https://pure-logic-flow.lovable.app/health";
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "get_auth_url", redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      window.location.href = result.authUrl;
    } catch (error) {
      console.error("Error connecting to WHOOP:", error);
      toast.error("Error al conectar con WHOOP");
    }
  }, [session?.access_token]);

  const handleCallback = useCallback(async (code: string) => {
    if (!session?.access_token) return;
    setIsLoading(true);
    try {
      const redirectUri = "https://pure-logic-flow.lovable.app/health";
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "exchange_code", code, redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setIsConnected(true);
      toast.success("WHOOP conectado correctamente");
      window.history.replaceState({}, document.title, "/health");
      await fetchData();
    } catch (error) {
      console.error("Error handling WHOOP callback:", error);
      toast.error("Error al conectar con WHOOP");
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  const fetchData = useCallback(async () => {
    if (!session?.access_token || !user) return;
    setIsFetching(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "fetch_data" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      if (result.data) {
        const hasData = result.data.recovery_score !== null || result.data.strain !== null || result.data.sleep_hours !== null;
        if (hasData) {
          setData({
            ...result.data,
            data_date: result.data.data_date || new Date().toISOString().split("T")[0],
            fetched_at: new Date().toISOString(),
          });
        } else {
          await loadDateData(selectedDate);
        }
      }
      await loadAvailableDates();
    } catch (error: any) {
      console.error("Error fetching WHOOP data:", error);
      if (error.message?.includes("reconnect") || error.message?.includes("expired")) {
        setIsConnected(false);
        toast.error("Sesión de WHOOP expirada, reconecta");
      } else {
        toast.error("Error al obtener datos de WHOOP");
      }
    } finally {
      setIsFetching(false);
    }
  }, [session?.access_token, user, selectedDate, loadDateData, loadAvailableDates]);

  const backfillHistory = useCallback(async (days: number = 30) => {
    if (!session?.access_token || !user) return;
    setIsBackfilling(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("whoop-sync", {
        body: { action: "backfill", userId: user.id, days },
      });
      if (error) throw error;
      toast.success(`Histórico cargado: ${result.synced} días sincronizados`);
      await loadAvailableDates();
      await loadDateData(selectedDate);
    } catch (error: any) {
      console.error("Error backfilling:", error);
      toast.error("Error cargando histórico");
    } finally {
      setIsBackfilling(false);
    }
  }, [session?.access_token, user, selectedDate, loadDateData, loadAvailableDates]);

  const disconnect = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "disconnect" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setIsConnected(false);
      setData(null);
      setAvailableDates([]);
      toast.success("WHOOP desconectado");
    } catch (error) {
      console.error("Error disconnecting WHOOP:", error);
      toast.error("Error al desconectar WHOOP");
    }
  }, [session?.access_token]);

  const changeDate = useCallback(async (date: Date) => {
    setSelectedDate(date);
    await loadDateData(date);
  }, [loadDateData]);

  // Load cached data on mount
  useEffect(() => {
    if (user) {
      loadDateData(selectedDate);
      loadAvailableDates();
    }
  }, [user]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code && session?.access_token) handleCallback(code);
  }, [session?.access_token, handleCallback]);

  return {
    isConnected, isLoading, isFetching, isBackfilling,
    data, selectedDate, availableDates,
    connect, disconnect, fetchData, backfillHistory, changeDate,
  };
};
