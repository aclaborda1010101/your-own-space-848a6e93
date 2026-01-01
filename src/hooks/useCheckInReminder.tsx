import { useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useCheckIn } from "@/hooks/useCheckIn";

const REMINDER_KEY = "jarvis_checkin_reminder_scheduled";
const PREFS_KEY = "jarvis_notification_prefs";

interface NotificationPreferences {
  dailyCheckIn: boolean;
  checkInTime: string;
}

const getPrefs = (): NotificationPreferences => {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return { dailyCheckIn: true, checkInTime: "08:00" };
};

export const useCheckInReminder = () => {
  const { permission, notifyCheckIn, isSupported } = usePushNotifications();
  const { isRegistered, loading } = useCheckIn();
  const scheduledRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSupported || permission !== "granted" || loading) return;

    const prefs = getPrefs();
    
    // Don't schedule if check-in notifications are disabled
    if (!prefs.dailyCheckIn) {
      scheduledRef.current = false;
      return;
    }

    // Don't schedule if already registered today
    if (isRegistered) {
      scheduledRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Check if we already scheduled today with same time
    const today = new Date().toDateString();
    const lastScheduled = localStorage.getItem(REMINDER_KEY);
    const scheduleKey = `${today}_${prefs.checkInTime}`;
    if (lastScheduled === scheduleKey && scheduledRef.current) return;

    const scheduleReminder = () => {
      const now = new Date();
      const [targetHour, targetMinute] = prefs.checkInTime.split(':').map(Number);

      // Calculate target time today
      const target = new Date(now);
      target.setHours(targetHour, targetMinute, 0, 0);

      // If it's already past the target time today, don't schedule
      if (now > target) {
        return undefined;
      }

      const delay = target.getTime() - now.getTime();

      // Only schedule if within 24 hours
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
          // Double-check if still not registered and notifications still enabled
          const currentPrefs = getPrefs();
          if (!isRegistered && currentPrefs.dailyCheckIn) {
            await notifyCheckIn();
          }
        }, delay);

        // Mark as scheduled
        scheduledRef.current = true;
        localStorage.setItem(REMINDER_KEY, scheduleKey);

        return () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        };
      }
      
      return undefined;
    };

    const cleanup = scheduleReminder();
    return cleanup;
  }, [isSupported, permission, isRegistered, loading, notifyCheckIn]);

  // Check immediately on mount if it's past the scheduled time and no check-in
  useEffect(() => {
    if (!isSupported || permission !== "granted" || loading || isRegistered) return;

    const prefs = getPrefs();
    if (!prefs.dailyCheckIn) return;

    const now = new Date();
    const [targetHour, targetMinute] = prefs.checkInTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculate if we're within 2 hours after the target time
    const targetMinutes = targetHour * 60 + targetMinute;
    const currentMinutes = currentHour * 60 + currentMinute;
    const diffMinutes = currentMinutes - targetMinutes;

    // If between target time and 2 hours after, remind now
    if (diffMinutes >= 0 && diffMinutes <= 120) {
      const reminderKey = `jarvis_checkin_immediate_${now.toDateString()}_${prefs.checkInTime}`;
      const alreadyReminded = localStorage.getItem(reminderKey);
      
      if (!alreadyReminded) {
        notifyCheckIn();
        localStorage.setItem(reminderKey, "true");
      }
    }
  }, [isSupported, permission, isRegistered, loading, notifyCheckIn]);
};

export default useCheckInReminder;
