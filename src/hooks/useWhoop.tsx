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
  data_date: string;
  fetched_at: string;
}

export const useWhoop = () => {
  const { user, session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [data, setData] = useState<WhoopData | null>(null);

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
      const redirectUri = `${window.location.origin}/health`;
      
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "get_auth_url", redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // Redirect to WHOOP OAuth
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
      const redirectUri = `${window.location.origin}/health`;
      
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "exchange_code", code, redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setIsConnected(true);
      toast.success("WHOOP conectado correctamente");
      
      // Clean up URL
      window.history.replaceState({}, document.title, "/health");
      
      // Fetch initial data
      await fetchData();
    } catch (error) {
      console.error("Error handling WHOOP callback:", error);
      toast.error("Error al conectar con WHOOP");
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;

    setIsFetching(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("whoop-auth", {
        body: { action: "fetch_data" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (result.data) {
        setData({
          ...result.data,
          data_date: new Date().toISOString().split("T")[0],
          fetched_at: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error("Error fetching WHOOP data:", error);
      if (error.message?.includes("reconnect")) {
        setIsConnected(false);
        toast.error("Sesión de WHOOP expirada, reconecta");
      } else {
        toast.error("Error al obtener datos de WHOOP");
      }
    } finally {
      setIsFetching(false);
    }
  }, [session?.access_token]);

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
      toast.success("WHOOP desconectado");
    } catch (error) {
      console.error("Error disconnecting WHOOP:", error);
      toast.error("Error al desconectar WHOOP");
    }
  }, [session?.access_token]);

  // Load cached data on mount
  useEffect(() => {
    const loadCachedData = async () => {
      if (!user) return;

      const { data: cachedData } = await supabase
        .from("whoop_data")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (cachedData) {
        setData({
          recovery_score: cachedData.recovery_score,
          hrv: cachedData.hrv,
          strain: cachedData.strain ? Number(cachedData.strain) : null,
          sleep_hours: cachedData.sleep_hours ? Number(cachedData.sleep_hours) : null,
          resting_hr: cachedData.resting_hr,
          sleep_performance: cachedData.sleep_performance,
          data_date: cachedData.data_date,
          fetched_at: cachedData.fetched_at,
        });
      }
    };

    loadCachedData();
  }, [user]);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    
    if (code && session?.access_token) {
      handleCallback(code);
    }
  }, [session?.access_token, handleCallback]);

  return {
    isConnected,
    isLoading,
    isFetching,
    data,
    connect,
    disconnect,
    fetchData,
  };
};