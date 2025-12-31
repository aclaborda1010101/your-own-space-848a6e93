import { useState, useEffect, useCallback } from "react";
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
    
    if (!token || !session?.access_token) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { 
          action: 'list',
          eventData: startDate && endDate ? { startDate, endDate } : undefined
        },
        headers: {
          'x-google-token': token,
        },
      });

      if (error) throw error;

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
  }, [session, getProviderToken]);

  useEffect(() => {
    if (connected) {
      fetchEvents();
    }
  }, [connected, fetchEvents]);

  const createEvent = async (eventData: CreateEventData) => {
    const token = getProviderToken();
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'create', eventData },
        headers: {
          'x-google-token': token,
        },
      });

      if (error) throw error;

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
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'update', eventData },
        headers: {
          'x-google-token': token,
        },
      });

      if (error) throw error;

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
    
    if (!token) {
      toast.error('Conecta tu cuenta de Google primero');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'delete', eventData: { eventId } },
        headers: {
          'x-google-token': token,
        },
      });

      if (error) throw error;

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
