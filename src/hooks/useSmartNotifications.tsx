import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDismissedAlerts } from "./useDismissedAlerts";

export interface SmartNotification {
  type: "overload" | "p0_urgent" | "rest" | "health" | "focus" | "motivation";
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionType?: "navigate_tasks" | "navigate_calendar" | "dismiss" | "start_break";
}

interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: string;
  dayMode: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  duration: number;
  completed: boolean;
}

interface CalendarEvent {
  title: string;
  time: string;
  duration: string;
}

export const useSmartNotifications = () => {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { dismissAlert, isDismissed, dismissedIds } = useDismissedAlerts();

  const fetchNotifications = useCallback(async (
    checkIn: CheckInData | null,
    tasks: Task[],
    calendarEvents: CalendarEvent[]
  ) => {
    setLoading(true);
    try {
      const currentHour = new Date().getHours();

      const { data, error } = await supabase.functions.invoke('smart-notifications', {
        body: { 
          checkIn, 
          tasks, 
          calendarEvents,
          currentHour,
        },
      });

      if (error) throw error;

      // Filter out already dismissed alerts (persisted in database)
      const newNotifications = (data.notifications || []).filter(
        (n: SmartNotification) => !isDismissed(`smart-${n.type}-${n.title}`)
      );

      setNotifications(newNotifications);
      return newNotifications;
    } catch (error) {
      console.error("Error fetching smart notifications:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isDismissed, dismissedIds]);

  const dismissNotification = useCallback(async (notification: SmartNotification) => {
    const alertId = `smart-${notification.type}-${notification.title}`;
    // Persist dismissal to database
    await dismissAlert(alertId);
    // Remove from local state immediately
    setNotifications(prev => prev.filter(n => `${n.type}-${n.title}` !== `${notification.type}-${notification.title}`));
  }, [dismissAlert]);

  const clearAllNotifications = useCallback(async () => {
    // Persist all dismissals
    for (const n of notifications) {
      await dismissAlert(`smart-${n.type}-${n.title}`);
    }
    setNotifications([]);
  }, [notifications, dismissAlert]);

  return {
    notifications,
    loading,
    fetchNotifications,
    dismissNotification,
    clearAllNotifications,
  };
};
