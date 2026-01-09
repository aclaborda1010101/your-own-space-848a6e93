import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  googleId?: string;
  title: string;
  date: string; // YYYY-MM-DD format
  time: string;
  duration: string;
  type: "work" | "life" | "finance" | "health" | "family";
  description?: string;
  location?: string;
  htmlLink?: string;
}

interface CreateEventData {
  title: string;
  date?: string; // YYYY-MM-DD format, defaults to today
  time: string;
  duration: number;
  description?: string;
  type?: string;
}

interface UpdateEventData {
  eventId: string;
  title?: string;
  time?: string;
  duration?: number;
  description?: string;
  type?: string;
}

// Token expiration buffer: refresh 5 minutes before actual expiration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const useGoogleCalendar = () => {
  const { session } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const refreshingRef = useRef(false);

  const getProviderToken = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const storedToken = localStorage.getItem("google_provider_token");
        if (storedToken) return storedToken;
      } catch {
        // ignore
      }
    }
    
    const sessionToken = session?.provider_token || null;
    if (sessionToken) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("google_provider_token", sessionToken);
          // Store expiration time (typically 1 hour from now for new sessions)
          const expiresAt = Date.now() + 3600 * 1000;
          localStorage.setItem("google_token_expires_at", expiresAt.toString());
        } catch {
          // ignore
        }
      }
      return sessionToken;
    }

    return null;
  }, [session]);

  const getRefreshToken = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const storedToken = localStorage.getItem("google_provider_refresh_token");
        if (storedToken) return storedToken;
      } catch {
        // ignore
      }
    }
    
    const sessionRefreshToken = session?.provider_refresh_token || null;
    if (sessionRefreshToken) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("google_provider_refresh_token", sessionRefreshToken);
        } catch {
          // ignore
        }
      }
      return sessionRefreshToken;
    }

    return null;
  }, [session]);

  const getTokenExpiresAt = useCallback((): number | null => {
    if (typeof window !== "undefined") {
      try {
        const expiresAt = localStorage.getItem("google_token_expires_at");
        return expiresAt ? parseInt(expiresAt, 10) : null;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const updateStoredAccessToken = useCallback((newToken: string, expiresIn?: number) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("google_provider_token", newToken);
        // Store new expiration time
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
        localStorage.setItem("google_token_expires_at", expiresAt.toString());
        console.log("Token updated, expires at:", new Date(expiresAt).toISOString());
      } catch {
        // ignore
      }
    }
  }, []);

  const clearStoredTokens = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("google_provider_token");
        localStorage.removeItem("google_provider_refresh_token");
        localStorage.removeItem("google_token_expires_at");
      } catch {
        // ignore
      }
    }
  }, []);

  // Proactive token refresh - refresh BEFORE it expires
  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent refresh attempts
    if (refreshingRef.current) {
      console.log("Token refresh already in progress, skipping");
      return true;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      console.log("No refresh token available");
      return false;
    }

    const expiresAt = getTokenExpiresAt();
    const now = Date.now();

    // Check if token needs refresh (expires within buffer time)
    if (expiresAt && expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
      console.log("Token still valid, expires in:", Math.round((expiresAt - now) / 1000 / 60), "minutes");
      return true; // Token is still valid
    }

    console.log("Token expired or expiring soon, refreshing proactively...");
    refreshingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'refresh-token' },
        headers: {
          'x-google-refresh-token': refreshToken,
        },
      });

      if (error) {
        console.error("Token refresh error:", error);
        refreshingRef.current = false;
        return false;
      }

      if (data.needsReauth || data.reason === 'insufficient_scopes') {
        console.log("Needs reauth:", data.message);
        clearStoredTokens(); // Clear invalid tokens
        setNeedsReauth(true);
        setConnected(false);
        refreshingRef.current = false;
        return false;
      }

      if (data.access_token) {
        updateStoredAccessToken(data.access_token, data.expires_in);
        console.log("Token refreshed successfully, valid for:", data.expires_in, "seconds");
        setNeedsReauth(false);
        refreshingRef.current = false;
        return true;
      }

      refreshingRef.current = false;
      return false;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      refreshingRef.current = false;
      return false;
    }
  }, [getRefreshToken, getTokenExpiresAt, updateStoredAccessToken]);

  const checkConnection = useCallback(() => {
    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    // Connected if we have either a valid token or a refresh token to get one
    const isConnected = !!(token || refreshToken);
    setConnected(isConnected);
    return isConnected;
  }, [getProviderToken, getRefreshToken]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Background token refresh every 30 minutes to ensure token is always fresh
  useEffect(() => {
    const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

    const refreshIfNeeded = async () => {
      if (document.visibilityState === "visible" && connected) {
        await refreshTokenIfNeeded();
      }
    };

    // Initial refresh check
    if (connected) {
      refreshIfNeeded();
    }

    const intervalId = setInterval(refreshIfNeeded, REFRESH_INTERVAL);

    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && connected) {
        refreshIfNeeded();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connected, refreshTokenIfNeeded]);

  const fetchEvents = useCallback(async (startDate?: string, endDate?: string, isBackgroundSync = false) => {
    // Ensure token is fresh before making API call
    const tokenValid = await refreshTokenIfNeeded();
    if (!tokenValid && !getProviderToken()) {
      setEvents([]);
      return;
    }

    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    
    if (!token || !session?.access_token) {
      setEvents([]);
      return;
    }

    if (isBackgroundSync) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const headers: Record<string, string> = {
        'x-google-token': token,
      };
      
      if (refreshToken) {
        headers['x-google-refresh-token'] = refreshToken;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { 
          action: 'list',
          eventData: startDate && endDate ? { startDate, endDate } : undefined
        },
        headers,
      });

      if (error) throw error;

      // Check if we got a new access token from refresh
      if (data.newAccessToken) {
        updateStoredAccessToken(data.newAccessToken, data.expiresIn);
      }

      if (data.needsReauth || data.reason === 'insufficient_scopes') {
        clearStoredTokens(); // Clear invalid tokens
        setNeedsReauth(true);
        setConnected(false);
        if (!isBackgroundSync) {
          toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        }
        return;
      }

      setEvents(data.events || []);
      setNeedsReauth(false);
      setLastSyncTime(new Date());
    } catch (error: any) {
      console.error('Error fetching calendar events:', error);
      if (!error.message?.includes('No Google token') && !isBackgroundSync) {
        toast.error('Error al cargar eventos del calendario');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [session, getProviderToken, getRefreshToken, updateStoredAccessToken, refreshTokenIfNeeded]);

  // Initial fetch when connected
  useEffect(() => {
    if (connected) {
      fetchEvents();
    }
  }, [connected, fetchEvents]);

  // Auto-sync every 2 minutes when tab is active (reduced frequency since we have fresh tokens)
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes

    const syncIfActive = () => {
      if (document.visibilityState === "visible" && connected) {
        const now = Date.now();
        if (now - lastSyncRef.current >= SYNC_INTERVAL - 1000) {
          lastSyncRef.current = now;
          fetchEvents(undefined, undefined, true);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && connected) {
        const now = Date.now();
        if (now - lastSyncRef.current >= SYNC_INTERVAL) {
          lastSyncRef.current = now;
          fetchEvents(undefined, undefined, true);
        }
      }
    };

    if (connected) {
      lastSyncRef.current = Date.now();
      intervalRef.current = setInterval(syncIfActive, SYNC_INTERVAL);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connected, fetchEvents]);

  const createEvent = async (eventData: CreateEventData) => {
    await refreshTokenIfNeeded();
    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return null;
    }

    try {
      const headers: Record<string, string> = {
        'x-google-token': token,
      };
      if (refreshToken) {
        headers['x-google-refresh-token'] = refreshToken;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'create', eventData },
        headers,
      });

      if (error) throw error;

      if (data.newAccessToken) {
        updateStoredAccessToken(data.newAccessToken, data.expiresIn);
      }

      if (data.needsReauth || data.reason === 'insufficient_scopes') {
        clearStoredTokens(); // Clear invalid tokens
        setNeedsReauth(true);
        setConnected(false);
        toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        return null;
      }

      toast.success('Evento creado en Google Calendar');
      await fetchEvents();
      return data.event;
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      toast.error('Error al crear evento en el calendario');
      return null;
    }
  };

  const updateEvent = async (eventData: UpdateEventData) => {
    await refreshTokenIfNeeded();
    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return null;
    }

    try {
      const headers: Record<string, string> = {
        'x-google-token': token,
      };
      if (refreshToken) {
        headers['x-google-refresh-token'] = refreshToken;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'update', eventData },
        headers,
      });

      if (error) throw error;

      if (data.newAccessToken) {
        updateStoredAccessToken(data.newAccessToken, data.expiresIn);
      }

      if (data.needsReauth || data.reason === 'insufficient_scopes') {
        clearStoredTokens(); // Clear invalid tokens
        setNeedsReauth(true);
        setConnected(false);
        toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        return null;
      }

      toast.success('Evento actualizado');
      await fetchEvents();
      return data.event;
    } catch (error: unknown) {
      console.error('Error updating calendar event:', error);
      toast.error('Error al actualizar evento');
      return null;
    }
  };

  const deleteEvent = async (eventId: string) => {
    await refreshTokenIfNeeded();
    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return false;
    }

    try {
      const headers: Record<string, string> = {
        'x-google-token': token,
      };
      if (refreshToken) {
        headers['x-google-refresh-token'] = refreshToken;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'delete', eventData: { eventId } },
        headers,
      });

      if (error) throw error;

      if (data.newAccessToken) {
        updateStoredAccessToken(data.newAccessToken, data.expiresIn);
      }

      if (data.needsReauth || data.reason === 'insufficient_scopes') {
        clearStoredTokens(); // Clear invalid tokens
        setNeedsReauth(true);
        setConnected(false);
        toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        return false;
      }

      toast.success('Evento eliminado');
      await fetchEvents();
      return true;
    } catch (error: unknown) {
      console.error('Error deleting calendar event:', error);
      toast.error('Error al eliminar evento');
      return false;
    }
  };

  const reconnectGoogle = async () => {
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // Clear old tokens before reconnecting
    clearStoredTokens();

    if (inIframe) {
      window.open(`${window.location.origin}/oauth/google`, "_blank");
      toast.info("Se abrió una pestaña para reconectar Google");
      return;
    }

    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/oauth/google/callback`,
          scopes:
            "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
        },
      });
    } catch (error) {
      toast.error("Error al conectar con Google");
    }
  };

  const disconnectGoogleCalendar = useCallback(() => {
    clearStoredTokens();
    setConnected(false);
    setNeedsReauth(true);
    setEvents([]);
    toast.success('Google Calendar desconectado. Puedes reconectar cuando quieras.');
  }, [clearStoredTokens]);

  return {
    events,
    loading,
    syncing,
    connected,
    needsReauth,
    lastSyncTime,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    reconnectGoogle,
    disconnectGoogleCalendar,
    clearStoredTokens,
  };
};
