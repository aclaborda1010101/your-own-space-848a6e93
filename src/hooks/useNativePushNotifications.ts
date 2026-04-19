import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PushNotificationSchema,
  type ActionPerformed,
  type Token,
} from "@capacitor/push-notifications";
import { Device } from "@capacitor/device";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PushPermission = "granted" | "denied" | "prompt" | "unknown";

export interface NativePushAPI {
  isNative: boolean;
  permission: PushPermission;
  token: string | null;
  registering: boolean;
  error: string | null;
  /** Pide permisos + registra el dispositivo y guarda el token en Supabase */
  registerDevice: () => Promise<boolean>;
  /** Borra el token actual del usuario en Supabase (logout, opt-out) */
  unregisterDevice: () => Promise<void>;
}

/**
 * Hook nativo para push notifications (iOS APNs / Android FCM).
 *
 * Flujo:
 *  1) `registerDevice()` pide permisos → `register()` → recibe APNs token.
 *  2) Token + metadatos del dispositivo van a `device_tokens` (UPSERT).
 *  3) Listeners:
 *      - `pushNotificationReceived`: toast in-app cuando la app está en foreground.
 *      - `pushNotificationActionPerformed`: deep link según `data.route`.
 *      - `registrationError`: log + estado de error.
 *  4) Al volver al foreground, refresca `last_seen` del token.
 */
export function useNativePushNotifications(): NativePushAPI {
  const isNative = Capacitor.isNativePlatform();
  const [permission, setPermission] = useState<PushPermission>("unknown");
  const [token, setToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comprobar permisos al montar
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await PushNotifications.checkPermissions();
        if (!cancelled) setPermission(mapPerm(status.receive));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  // Listeners + refresh on resume
  useEffect(() => {
    if (!isNative) return;
    const subs: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      const onRegistration = await PushNotifications.addListener("registration", async (t: Token) => {
        setToken(t.value);
        await persistToken(t.value);
      });
      subs.push(onRegistration);

      const onError = await PushNotifications.addListener("registrationError", (err) => {
        console.error("[push] registrationError:", err);
        setError(err.error ?? "Push registration error");
      });
      subs.push(onError);

      const onReceived = await PushNotifications.addListener(
        "pushNotificationReceived",
        (n: PushNotificationSchema) => {
          toast(n.title ?? "Notificación", { description: n.body ?? "" });
        },
      );
      subs.push(onReceived);

      const onAction = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: ActionPerformed) => {
          const data = (action.notification?.data ?? {}) as Record<string, unknown>;
          const route = typeof data.route === "string" ? data.route : null;
          if (route) {
            // Deep link interno
            try {
              window.location.assign(route);
            } catch {
              /* noop */
            }
          }
        },
      );
      subs.push(onAction);

      const onResume = await App.addListener("resume", async () => {
        // Refresca last_seen para saber qué dispositivos siguen activos
        await refreshLastSeen();
      });
      subs.push(onResume);
    })();

    return () => {
      subs.forEach((s) => s.remove().catch(() => undefined));
    };
  }, [isNative]);

  const registerDevice = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    setRegistering(true);
    setError(null);
    try {
      const status = await PushNotifications.requestPermissions();
      const mapped = mapPerm(status.receive);
      setPermission(mapped);
      if (mapped !== "granted") {
        return false;
      }
      await PushNotifications.register();
      // El token llega vía listener 'registration'
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setRegistering(false);
    }
  }, [isNative]);

  const unregisterDevice = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !token) return;
      await supabase
        .from("device_tokens")
        .update({ is_active: false })
        .eq("user_id", uid)
        .eq("token", token);
      setToken(null);
    } catch (e) {
      console.warn("[push] unregister failed:", e);
    }
  }, [token]);

  return {
    isNative,
    permission,
    token,
    registering,
    error,
    registerDevice,
    unregisterDevice,
  };
}

function mapPerm(p: string): PushPermission {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

async function persistToken(deviceToken: string) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    let appVersion: string | undefined;
    let deviceModel: string | undefined;
    let osVersion: string | undefined;
    try {
      const info = await Device.getInfo();
      deviceModel = info.model;
      osVersion = info.osVersion;
    } catch {
      /* ignore */
    }
    try {
      const app = await App.getInfo();
      appVersion = app.version;
    } catch {
      /* ignore */
    }

    const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";

    await supabase.from("device_tokens").upsert(
      {
        user_id: uid,
        token: deviceToken,
        platform,
        app_version: appVersion ?? null,
        device_model: deviceModel ?? null,
        os_version: osVersion ?? null,
        is_active: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
  } catch (e) {
    console.warn("[push] persistToken failed:", e);
  }
}

async function refreshLastSeen() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase
      .from("device_tokens")
      .update({ last_seen: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("is_active", true);
  } catch {
    /* ignore */
  }
}

export default useNativePushNotifications;
