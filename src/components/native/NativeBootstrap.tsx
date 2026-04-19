import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNativePushNotifications } from "@/hooks/useNativePushNotifications";

/**
 * Mounts inside <ProtectedPage> so it only runs for authenticated users.
 * - On native, attempts a silent register: if permission was already granted,
 *   refreshes the APNs token; if it's still 'prompt', does nothing (the user
 *   must grant permission from Settings → Notifications first).
 */
export function NativeBootstrap() {
  const { user } = useAuth();
  const push = useNativePushNotifications();

  useEffect(() => {
    if (!user || !push.isNative) return;
    if (push.permission === "granted") {
      void push.registerDevice();
    }
  }, [user, push.isNative, push.permission]);

  return null;
}

export default NativeBootstrap;
