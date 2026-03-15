export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function scheduleHealthNotification(message: string, timeStr: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  // Only schedule if within 24 hours (browser tabs may close)
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      new Notification("JARVIS · Salud", {
        body: message,
        icon: "/favicon.ico",
        tag: `health-${timeStr}`,
        requireInteraction: true,
      });
    }, delay);
  }
}

export function sendImmediateNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: `health-immediate-${Date.now()}`,
  });
}
