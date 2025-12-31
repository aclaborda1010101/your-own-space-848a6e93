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

export const useGoogleCalendar = () => {
  const { session } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  const getProviderToken = useCallback(() => {
    const sessionToken = session?.provider_token || null;
    if (sessionToken) return sessionToken;

    // In preview OAuth flow we persist provider_token separately (postMessage bridge).
    if (typeof window !== "undefined") {
      return localStorage.getItem("google_provider_token");
    }

    return null;
  }, [session]);

  const getRefreshToken = useCallback(() => {
    const sessionRefreshToken = session?.provider_refresh_token || null;
    if (sessionRefreshToken) return sessionRefreshToken;

    // In preview OAuth flow we persist provider_refresh_token separately.
    if (typeof window !== "undefined") {
      return localStorage.getItem("google_provider_refresh_token");
    }

    return null;
  }, [session]);

  // Helper to update stored access token after refresh
  const updateStoredAccessToken = useCallback((newToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("google_provider_token", newToken);
    }
  }, []);

  const checkConnection = useCallback(() => {
    const token = getProviderToken();
    setConnected(!!token);
    return !!token;
  }, [getProviderToken]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const fetchEvents = useCallback(async (startDate?: string, endDate?: string) => {
    const token = getProviderToken();
    const refreshToken = getRefreshToken();
    
    if (!token || !session?.access_token) {
      setEvents([]);
      return;
    }

    setLoading(true);
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
        updateStoredAccessToken(data.newAccessToken);
      }

      if (data.needsReauth) {
        setNeedsReauth(true);
        setConnected(false);
        toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        return;
      }

      setEvents(data.events || []);
      setNeedsReauth(false);
    } catch (error: any) {
      console.error('Error fetching calendar events:', error);
      // Don't show error toast for expected auth issues
      if (!error.message?.includes('No Google token')) {
        toast.error('Error al cargar eventos del calendario');
      }
    } finally {
      setLoading(false);
    }
  }, [session, getProviderToken, getRefreshToken, updateStoredAccessToken]);

  // Initial fetch when connected
  useEffect(() => {
    if (connected) {
      fetchEvents();
    }
  }, [connected, fetchEvents]);

  // Auto-sync every 1 minute when tab is active
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const SYNC_INTERVAL = 60 * 1000; // 1 minute

    const syncIfActive = () => {
      if (document.visibilityState === "visible" && connected) {
        const now = Date.now();
        // Prevent syncing more frequently than the interval
        if (now - lastSyncRef.current >= SYNC_INTERVAL - 1000) {
          lastSyncRef.current = now;
          fetchEvents();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && connected) {
        // When tab becomes visible, check if we need to sync
        const now = Date.now();
        if (now - lastSyncRef.current >= SYNC_INTERVAL) {
          lastSyncRef.current = now;
          fetchEvents();
        }
      }
    };

    if (connected) {
      // Set initial sync time
      lastSyncRef.current = Date.now();
      
      // Start interval
      intervalRef.current = setInterval(syncIfActive, SYNC_INTERVAL);
      
      // Listen for visibility changes
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
        updateStoredAccessToken(data.newAccessToken);
      }

      if (data.needsReauth) {
        setNeedsReauth(true);
        toast.error(data.message || 'Necesitas reconectar tu cuenta de Google');
        return null;
      }

      toast.success('Evento creado en Google Calendar');
      await fetchEvents(); // Refresh events
      return data.event;
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      toast.error('Error al crear evento en el calendario');
      return null;
    }
  };

  const updateEvent = async (eventData: UpdateEventData) => {
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
        updateStoredAccessToken(data.newAccessToken);
      }

      if (data.needsReauth) {
        setNeedsReauth(true);
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
        updateStoredAccessToken(data.newAccessToken);
      }

      if (data.needsReauth) {
        setNeedsReauth(true);
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
    // In embedded previews, start OAuth from a top-level tab to avoid iframe storage issues.
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

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
        },
      });
    } catch (error) {
      toast.error("Error al conectar con Google");
    }
  };

  return {
    events,
    loading,
    connected,
    needsReauth,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    reconnectGoogle,
  };
};
