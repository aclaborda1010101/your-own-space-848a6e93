import { useMemo, useCallback } from "react";
import { useGoogleCalendar, CalendarEvent } from "./useGoogleCalendar";
import { useICloudCalendar, ICloudEvent } from "./useICloudCalendar";
import { getLocalDateString } from "@/lib/dateUtils";

export type { CalendarEvent };

/**
 * Transform an iCloud event into the unified CalendarEvent format.
 */
const transformICloudEvent = (event: ICloudEvent, fallbackDate?: string): CalendarEvent => {
  const date = (event as any).date || fallbackDate || getLocalDateString();
  return {
    id: `icloud-${event.id}`,
    title: event.title,
    date,
    time: event.time,
    duration: event.duration,
    type: event.type === "family" ? "life" : event.type,
    location: event.location,
  };
};

/**
 * Unified calendar hook that combines Google Calendar and iCloud Calendar.
 */
export const useCalendar = () => {
  const gc = useGoogleCalendar();
  const ic = useICloudCalendar();

  const connected = gc.connected || ic.connected;
  const loading = gc.loading || ic.loading;
  const syncing = gc.syncing || false;

  const events = useMemo(() => {
    const googleEvents = gc.events || [];
    const icloudEvents = (ic.events || []).map((e) => transformICloudEvent(e));
    return [...googleEvents, ...icloudEvents].sort((a, b) => a.time.localeCompare(b.time));
  }, [gc.events, ic.events]);

  const fetchEvents = useCallback(
    async (startDate?: string, endDate?: string) => {
      const promises: Promise<any>[] = [];

      if (gc.connected) {
        promises.push(gc.fetchEvents(startDate, endDate));
      }

      if (ic.connected) {
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : undefined;
        promises.push(ic.fetchEvents(start, end));
      }

      await Promise.allSettled(promises);
    },
    [gc.connected, ic.connected, gc.fetchEvents, ic.fetchEvents]
  );

  return {
    events,
    loading,
    syncing,
    connected,
    needsReauth: gc.needsReauth,
    lastSyncTime: gc.lastSyncTime,
    fetchEvents,
    createEvent: gc.createEvent,
    updateEvent: gc.updateEvent,
    deleteEvent: gc.deleteEvent,
    checkConnection: () => gc.connected || ic.connected,
    reconnectGoogle: gc.reconnectGoogle,
    icloudConnected: ic.connected,
    googleConnected: gc.connected,
  };
};

// Re-export for backward compatibility
export { useCalendar as useUnifiedCalendar };
