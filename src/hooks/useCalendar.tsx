import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format
  time: string;
  duration: string;
  type: "work" | "life" | "finance" | "health" | "family";
  description?: string;
  location?: string;
  allDay?: boolean;
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

/**
 * Unified calendar hook that uses iCloud Calendar via CalDAV
 * This is the sole calendar provider for the application
 */
export const useCalendar = () => {
  const { session, user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const getUserTimezone = useCallback(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Europe/Madrid";
    }
  }, []);

  // Check connection status on mount
  const checkConnection = useCallback(async () => {
    if (!session?.access_token) {
      setConnected(false);
      return false;
    }

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
        return false;
      }

      const isConnected = data?.connected ?? false;
      setConnected(isConnected);
      return isConnected;
    } catch (error) {
      console.error("iCloud connection check failed:", error);
      setConnected(false);
      return false;
    }
  }, [session?.access_token, getUserTimezone]);

  useEffect(() => {
    if (user) {
      checkConnection();
    }
  }, [user, checkConnection]);

  const fetchEvents = useCallback(
    async (startDate?: string, endDate?: string, isBackgroundSync = false) => {
      if (!session?.access_token) {
        setEvents([]);
        return;
      }

      if (isBackgroundSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      try {
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date(start);
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
          if (!isBackgroundSync) {
            toast.error("Error al cargar eventos del calendario");
          }
          return;
        }

        if (!data?.connected && data?.message) {
          setConnected(false);
          setNeedsReauth(true);
          return;
        }

        // Transform iCloud events to the standard CalendarEvent format
        const fetchedEvents: CalendarEvent[] = (data?.events || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          date: start.toISOString().split("T")[0], // Use the start date we queried
          time: event.time,
          duration: event.duration,
          type: event.type as CalendarEvent["type"],
          location: event.location,
          allDay: event.allDay,
        }));

        setEvents(fetchedEvents);
        setConnected(true);
        setNeedsReauth(false);
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("iCloud fetch failed:", error);
        if (!isBackgroundSync) {
          toast.error("Error al cargar eventos del calendario");
        }
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [session?.access_token, getUserTimezone]
  );

  const createEvent = useCallback(
    async (eventData: CreateEventData) => {
      if (!session?.access_token) {
        toast.error("Conecta tu calendario primero");
        return null;
      }

      try {
        const eventDate = eventData.date || new Date().toISOString().split("T")[0];
        const startDateTime = new Date(`${eventDate}T${eventData.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + eventData.duration * 60 * 1000);

        const { data, error } = await supabase.functions.invoke("icloud-calendar", {
          body: {
            action: "create",
            title: eventData.title,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            description: eventData.description,
            allDay: false,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-user-timezone": getUserTimezone(),
          },
        });

        if (error) {
          console.error("iCloud create error:", error);
          toast.error("Error al crear evento");
          return null;
        }

        toast.success("Evento creado en el calendario");
        await fetchEvents();
        return data;
      } catch (error) {
        console.error("iCloud create failed:", error);
        toast.error("Error al crear evento");
        return null;
      }
    },
    [session?.access_token, getUserTimezone, fetchEvents]
  );

  const updateEvent = useCallback(
    async (eventData: UpdateEventData) => {
      // iCloud CalDAV update would require finding and modifying the .ics file
      // For now, we'll show a message that this feature is coming
      toast.info("La edición de eventos de iCloud estará disponible próximamente");
      return null;
    },
    []
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      // iCloud CalDAV delete would require a DELETE request to the .ics file
      // For now, we'll show a message that this feature is coming
      toast.info("La eliminación de eventos de iCloud estará disponible próximamente");
      return false;
    },
    []
  );

  const reconnect = useCallback(async () => {
    // For iCloud, reconnection means re-entering credentials in Settings
    toast.info("Ve a Ajustes para reconectar tu calendario de iCloud");
  }, []);

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
    checkConnection,
    reconnectGoogle: reconnect, // Keep same interface for compatibility
  };
};

// Re-export as useGoogleCalendar for backward compatibility
export { useCalendar as useUnifiedCalendar };
