import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ScheduleOptions, type LocalNotificationSchema } from "@capacitor/local-notifications";

export type LocalNotifPermission = "granted" | "denied" | "prompt" | "unknown";

export interface ScheduleEventReminderInput {
  /** unique numeric id (use a hash of the eventId) */
  id: number;
  title: string;
  body?: string;
  /** Date when the notification should fire. Will subtract `minutesBefore` automatically. */
  fireAt: Date;
  /** Minutes before fireAt to actually trigger (default 15) */
  minutesBefore?: number;
  data?: Record<string, unknown>;
}

export interface UseLocalNotificationsAPI {
  isNative: boolean;
  permission: LocalNotifPermission;
  requestPermission: () => Promise<boolean>;
  scheduleEventReminder: (input: ScheduleEventReminderInput) => Promise<boolean>;
  cancelById: (id: number) => Promise<void>;
  cancelAll: () => Promise<void>;
  listScheduled: () => Promise<LocalNotificationSchema[]>;
}

/**
 * Local (offline) notifications. Used to remind the user 15 min before
 * a calendar event without depending on the network or push servers.
 */
export function useLocalNotifications(): UseLocalNotificationsAPI {
  const isNative = Capacitor.isNativePlatform();
  const [permission, setPermission] = useState<LocalNotifPermission>("unknown");

  useEffect(() => {
    if (!isNative) return;
    (async () => {
      try {
        const r = await LocalNotifications.checkPermissions();
        setPermission(mapPerm(r.display));
      } catch {
        /* noop */
      }
    })();
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const r = await LocalNotifications.requestPermissions();
      const mapped = mapPerm(r.display);
      setPermission(mapped);
      return mapped === "granted";
    } catch {
      return false;
    }
  }, [isNative]);

  const scheduleEventReminder = useCallback(
    async (input: ScheduleEventReminderInput): Promise<boolean> => {
      if (!isNative) return false;
      const minutesBefore = input.minutesBefore ?? 15;
      const at = new Date(input.fireAt.getTime() - minutesBefore * 60 * 1000);
      if (at.getTime() < Date.now() + 5_000) {
        // Too late to schedule
        return false;
      }
      try {
        if (permission !== "granted") {
          const ok = await requestPermission();
          if (!ok) return false;
        }
        const opts: ScheduleOptions = {
          notifications: [
            {
              id: input.id,
              title: input.title,
              body: input.body ?? "",
              schedule: { at, allowWhileIdle: true },
              extra: input.data ?? {},
            },
          ],
        };
        await LocalNotifications.schedule(opts);
        return true;
      } catch (e) {
        console.error("[localNotifications] schedule failed:", e);
        return false;
      }
    },
    [isNative, permission, requestPermission],
  );

  const cancelById = useCallback(
    async (id: number) => {
      if (!isNative) return;
      try {
        await LocalNotifications.cancel({ notifications: [{ id }] });
      } catch {
        /* noop */
      }
    },
    [isNative],
  );

  const cancelAll = useCallback(async () => {
    if (!isNative) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
    } catch {
      /* noop */
    }
  }, [isNative]);

  const listScheduled = useCallback(async (): Promise<LocalNotificationSchema[]> => {
    if (!isNative) return [];
    try {
      const r = await LocalNotifications.getPending();
      return r.notifications;
    } catch {
      return [];
    }
  }, [isNative]);

  return {
    isNative,
    permission,
    requestPermission,
    scheduleEventReminder,
    cancelById,
    cancelAll,
    listScheduled,
  };
}

function mapPerm(p: string): LocalNotifPermission {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

export default useLocalNotifications;
