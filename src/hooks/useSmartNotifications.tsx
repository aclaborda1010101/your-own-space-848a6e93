import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

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

      const newNotifications = (data.notifications || []).filter(
        (n: SmartNotification) => !dismissedIds.has(`${n.type}-${n.title}`)
      );

      setNotifications(newNotifications);
      return newNotifications;
    } catch (error) {
      console.error("Error fetching smart notifications:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [dismissedIds]);

  const dismissNotification = useCallback((notification: SmartNotification) => {
    const id = `${notification.type}-${notification.title}`;
    setDismissedIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.filter(n => `${n.type}-${n.title}` !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    const allIds = notifications.map(n => `${n.type}-${n.title}`);
    setDismissedIds(prev => new Set([...prev, ...allIds]));
    setNotifications([]);
  }, [notifications]);

  return {
    notifications,
    loading,
    fetchNotifications,
    dismissNotification,
    clearAllNotifications,
  };
};
