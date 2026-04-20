import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNativePushNotifications } from "@/hooks/useNativePushNotifications";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";

/**
 * Mounts inside <ProtectedPage> so it only runs for authenticated users.
 * - On native, attempts a silent push registration (if already granted, refresh
 *   APNs token; if 'prompt', user must opt in manually).
 * - Triggers the local-notifications permission prompt once per session so the
 *   app can schedule offline calendar reminders without network.
 */
export function NativeBootstrap() {
  const { user } = useAuth();
  const push = useNativePushNotifications();
  const local = useLocalNotifications();

  // Push: silent re-register if already granted
  useEffect(() => {
    if (!user || !push.isNative) return;
    if (push.permission === "granted") {
      void push.registerDevice();
    }
  }, [user, push.isNative, push.permission]);

  // Local notifications: ask once per session if still in 'prompt'
  useEffect(() => {
    if (!user || !local.isNative) return;
    if (local.permission === "prompt") {
      const askedKey = "__jarvis_local_notif_asked";
      if (sessionStorage.getItem(askedKey)) return;
      sessionStorage.setItem(askedKey, "1");
      void local.requestPermission();
    }
  }, [user, local.isNative, local.permission]);

  return null;
}

export default NativeBootstrap;
