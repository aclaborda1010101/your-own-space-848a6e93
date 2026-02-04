import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface ICloudEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "work" | "life" | "health" | "family";
  location?: string;
  allDay?: boolean;
}

export const useICloudCalendar = () => {
  const { user, session } = useAuth();
  const [events, setEvents] = useState<ICloudEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const checkConnection = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke("icloud-calendar", {
        body: { action: "check" },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-user-timezone": getUserTimezone(),
        },
      });

      if (error) {
        console.error("iCloud check error:", error);
        setConnected(false);
        return;
      }

      setConnected(data?.connected ?? false);
    } catch (error) {
      console.error("iCloud connection check failed:", error);
      setConnected(false);
    }
  }, [session?.access_token]);

  const fetchEvents = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!session?.access_token) return [];

    setLoading(true);
    try {
      const start = startDate || new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = endDate || new Date(start);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.functions.invoke("icloud-calendar", {
        body: {
          action: "fetch",
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-user-timezone": getUserTimezone(),
        },
      });

      if (error) {
        console.error("iCloud fetch error:", error);
        toast({
          title: "Error al cargar eventos",
          description: "No se pudieron cargar los eventos de iCloud",
          variant: "destructive",
        });
        return [];
      }

      if (!data?.connected && data?.message) {
        setConnected(false);
        return [];
      }

      const fetchedEvents = data?.events || [];
      setEvents(fetchedEvents);
      setConnected(true);
      setLastSync(new Date());

      return fetchedEvents;
    } catch (error) {
      console.error("iCloud fetch failed:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const createEvent = useCallback(async (event: {
    title: string;
    start: string;
    end?: string;
    location?: string;
    description?: string;
    allDay?: boolean;
  }) => {
    if (!session?.access_token) {
      toast({
        title: "No autenticado",
        description: "Por favor inicia sesión para crear eventos",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke("icloud-calendar", {
        body: {
          action: "create",
          ...event,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-user-timezone": getUserTimezone(),
        },
      });

      if (error) {
        console.error("iCloud create error:", error);
        toast({
          title: "Error al crear evento",
          description: "No se pudo crear el evento en iCloud",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Evento creado",
        description: "El evento se ha añadido a tu calendario de iCloud",
      });

      // Refresh events
      await fetchEvents();

      return data;
    } catch (error) {
      console.error("iCloud create failed:", error);
      return null;
    }
  }, [session?.access_token, fetchEvents]);

  // Check connection on mount
  useEffect(() => {
    if (user) {
      checkConnection();
    }
  }, [user, checkConnection]);

  // Auto-fetch today's events when connected
  useEffect(() => {
    if (connected && user) {
      fetchEvents();
    }
  }, [connected, user, fetchEvents]);

  return {
    events,
    loading,
    connected,
    lastSync,
    fetchEvents,
    createEvent,
    checkConnection,
  };
};
