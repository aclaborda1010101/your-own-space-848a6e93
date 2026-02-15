import { useGoogleCalendar, CalendarEvent } from "./useGoogleCalendar";

export type { CalendarEvent };

/**
 * Unified calendar hook that delegates to Google Calendar.
 * Maintains the same public interface for backward compatibility.
 */
export const useCalendar = () => {
  const gc = useGoogleCalendar();

  return {
    events: gc.events,
    loading: gc.loading,
    syncing: gc.syncing,
    connected: gc.connected,
    needsReauth: gc.needsReauth,
    lastSyncTime: gc.lastSyncTime,
    fetchEvents: gc.fetchEvents,
    createEvent: gc.createEvent,
    updateEvent: gc.updateEvent,
    deleteEvent: gc.deleteEvent,
    checkConnection: () => gc.connected,
    reconnectGoogle: gc.reconnectGoogle,
  };
};

// Re-export for backward compatibility
export { useCalendar as useUnifiedCalendar };
