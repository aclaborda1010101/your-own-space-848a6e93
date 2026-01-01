import { useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useCheckIn } from "@/hooks/useCheckIn";

const REMINDER_KEY = "jarvis_checkin_reminder_scheduled";

export const useCheckInReminder = () => {
  const { permission, notifyCheckIn, isSupported } = usePushNotifications();
  const { isRegistered, loading } = useCheckIn();
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (!isSupported || permission !== "granted" || loading) return;

    // Don't schedule if already registered today
    if (isRegistered) {
      scheduledRef.current = false;
      return;
    }

    // Check if we already scheduled today
    const today = new Date().toDateString();
    const lastScheduled = localStorage.getItem(REMINDER_KEY);
    if (lastScheduled === today && scheduledRef.current) return;

    const scheduleReminder = () => {
      const now = new Date();
      const targetHour = 8; // 8:00 AM
      const targetMinute = 0;

      // Calculate next 8:00 AM
      const target = new Date(now);
      target.setHours(targetHour, targetMinute, 0, 0);

      // If it's already past 8:00 AM today, don't schedule for today
      if (now > target) {
        return;
      }

      const delay = target.getTime() - now.getTime();

      // Only schedule if within 24 hours
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timeoutId = setTimeout(async () => {
          // Double-check if still not registered
          if (!isRegistered) {
            await notifyCheckIn();
          }
        }, delay);

        // Mark as scheduled
        scheduledRef.current = true;
        localStorage.setItem(REMINDER_KEY, today);

        return () => clearTimeout(timeoutId);
      }
    };

    const cleanup = scheduleReminder();
    return cleanup;
  }, [isSupported, permission, isRegistered, loading, notifyCheckIn]);

  // Also check immediately on mount if it's past 8 AM and no check-in
  useEffect(() => {
    if (!isSupported || permission !== "granted" || loading || isRegistered) return;

    const now = new Date();
    const hour = now.getHours();

    // If it's between 8 AM and 10 AM and no check-in, remind now
    if (hour >= 8 && hour < 10) {
      const reminderKey = `jarvis_checkin_immediate_${now.toDateString()}`;
      const alreadyReminded = localStorage.getItem(reminderKey);
      
      if (!alreadyReminded) {
        notifyCheckIn();
        localStorage.setItem(reminderKey, "true");
      }
    }
  }, [isSupported, permission, isRegistered, loading, notifyCheckIn]);
};

export default useCheckInReminder;
