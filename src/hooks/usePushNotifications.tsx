import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

interface ScheduledNotification {
  id: string;
  time: Date;
  options: NotificationOptions;
}

const STORAGE_KEY = "jarvis_scheduled_notifications";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);

  useEffect(() => {
    // Only check for Notification API - service worker is optional for basic notifications
    const supported = "Notification" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      loadScheduledNotifications();
    }
  }, []);

  const loadScheduledNotifications = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored) as ScheduledNotification[];
        setScheduledNotifications(notifications.map(n => ({ ...n, time: new Date(n.time) })));
      }
    } catch {
      // Ignore storage errors
    }
  };

  const saveScheduledNotifications = (notifications: ScheduledNotification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore storage errors
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Las notificaciones no están soportadas en este navegador");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast.success("¡Notificaciones activadas!");
        return true;
      } else if (result === "denied") {
        toast.error("Notificaciones bloqueadas. Actívalas en la configuración del navegador.");
        return false;
      }
      return false;
    } catch {
      toast.error("Error al solicitar permisos de notificación");
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(async (options: NotificationOptions) => {
    if (!isSupported) return null;
    
    if (permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    try {
      // Try to use service worker notification first (works in background)
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || "/pwa-192x192.png",
          badge: options.badge || "/pwa-192x192.png",
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction,
        });
        return true;
      }
      
      // Fallback to regular notification
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/pwa-192x192.png",
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }, [isSupported, permission, requestPermission]);

  const scheduleNotification = useCallback((
    id: string,
    time: Date,
    options: NotificationOptions
  ) => {
    const notification: ScheduledNotification = { id, time, options };
    const updated = [...scheduledNotifications.filter(n => n.id !== id), notification];
    setScheduledNotifications(updated);
    saveScheduledNotifications(updated);

    // Set timeout if notification is in the future
    const delay = time.getTime() - Date.now();
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Max 24 hours
      setTimeout(() => {
        showNotification(options);
        // Remove from scheduled
        const remaining = scheduledNotifications.filter(n => n.id !== id);
        setScheduledNotifications(remaining);
        saveScheduledNotifications(remaining);
      }, delay);
    }

    return id;
  }, [scheduledNotifications, showNotification]);

  const cancelNotification = useCallback((id: string) => {
    const updated = scheduledNotifications.filter(n => n.id !== id);
    setScheduledNotifications(updated);
    saveScheduledNotifications(updated);
  }, [scheduledNotifications]);

  // Notification presets
  const notifyTaskReminder = useCallback((taskTitle: string, priority: string) => {
    return showNotification({
      title: priority === "P0" ? "Tarea Urgente" : "Recordatorio de Tarea",
      body: taskTitle,
      tag: "task-reminder",
      requireInteraction: priority === "P0",
    });
  }, [showNotification]);

  const notifyCheckIn = useCallback(() => {
    return showNotification({
      title: "Buenos dias!",
      body: "Es hora de hacer tu check-in diario",
      tag: "daily-checkin",
      requireInteraction: true,
    });
  }, [showNotification]);

  const notifyPomodoroEnd = useCallback((type: "work" | "break") => {
    return showNotification({
      title: type === "work" ? "Pomodoro completado!" : "Descanso terminado!",
      body: type === "work" ? "Tiempo de un descanso" : "¡Vuelve al trabajo!",
      tag: "pomodoro",
    });
  }, [showNotification]);

  const notifyCalendarEvent = useCallback((eventTitle: string, minutesBefore: number) => {
    return showNotification({
      title: "Evento proximo",
      body: `${eventTitle} comienza en ${minutesBefore} minutos`,
      tag: "calendar-event",
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleNotification,
    cancelNotification,
    scheduledNotifications,
    // Presets
    notifyTaskReminder,
    notifyCheckIn,
    notifyPomodoroEnd,
    notifyCalendarEvent,
  };
};

export default usePushNotifications;
