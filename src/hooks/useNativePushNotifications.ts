import { useCallback, useEffect, useRef, useState } from "react";
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
  /** True once token is persisted in `device_tokens` for the current user. */
  deviceRegistered: boolean;
  /** Number of active iOS device rows for this user (refreshed on register/resume). */
  activeDeviceCount: number;
  error: string | null;
  /** Pide permisos + registra el dispositivo y guarda el token en Supabase */
  registerDevice: () => Promise<boolean>;
  /** Borra el token actual del usuario en Supabase (logout, opt-out) */
  unregisterDevice: () => Promise<void>;
  /** Re-cuenta dispositivos activos (sin re-registrar). */
  refreshActiveDevices: () => Promise<void>;
}

/**
 * Hook nativo para push notifications (iOS APNs / Android FCM).
 *
 * Flujo:
 *  1) `registerDevice()` pide permisos → `register()` → recibe APNs token.
 *  2) Token + metadatos → `device_tokens` UPSERT por `token` (unique key real).
 *  3) Si la fila existía con `user_id=NULL` (registro antes del login),
 *     la reclama para el usuario actual.
 *  4) Listeners: registration / received / action / error.
 *  5) Recuento de dispositivos activos para que la UI sepa si hay que mostrar
 *     "Sin dispositivos activos" o no.
 */
export function useNativePushNotifications(): NativePushAPI {
  const isNative = Capacitor.isNativePlatform();
  const [permission, setPermission] = useState<PushPermission>("unknown");
  const [token, setToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [activeDeviceCount, setActiveDeviceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Buffer the token if it arrives before auth resolves
  const pendingTokenRef = useRef<string | null>(null);

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

  // Initial active-device count + on auth changes flush any pending token
  useEffect(() => {
    void refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user && pendingTokenRef.current) {
        const t = pendingTokenRef.current;
        pendingTokenRef.current = null;
        console.log("[push] auth ready, flushing pending token");
        await persistToken(t, setError);
      }
      await refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Listeners + refresh on resume
  useEffect(() => {
    if (!isNative) return;
    const subs: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      const onRegistration = await PushNotifications.addListener("registration", async (t: Token) => {
        console.log("[push] registration token received:", t.value.slice(0, 12) + "…");
        setToken(t.value);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          console.warn("[push] no auth user yet — buffering token");
          pendingTokenRef.current = t.value;
          return;
        }
        const ok = await persistToken(t.value, setError);
        if (ok) {
          await refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
        }
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
        await refreshLastSeen();
        await refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
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
      console.log("[push] permission status:", mapped);
      if (mapped !== "granted") {
        return false;
      }
      await PushNotifications.register();
      // El token llega vía listener 'registration' (puede ser inmediato o async)
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[push] registerDevice error:", msg);
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
      setDeviceRegistered(false);
      await refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
    } catch (e) {
      console.warn("[push] unregister failed:", e);
    }
  }, [token]);

  const refreshActiveDevices = useCallback(async () => {
    await refreshActiveCount(setActiveDeviceCount, setDeviceRegistered);
  }, []);

  return {
    isNative,
    permission,
    token,
    registering,
    deviceRegistered,
    activeDeviceCount,
    error,
    registerDevice,
    unregisterDevice,
    refreshActiveDevices,
  };
}

function mapPerm(p: string): PushPermission {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

async function persistToken(
  deviceToken: string,
  onError: (e: string | null) => void,
): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      console.warn("[push] persistToken: no authenticated user");
      return false;
    }

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

    // The real unique constraint is on `token` (not user_id+token), so upsert
    // by token. This also reclaims orphan rows that have user_id=NULL because
    // they were saved before auth resolved.
    const { error: upErr } = await supabase.from("device_tokens").upsert(
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
      { onConflict: "token" },
    );
    if (upErr) {
      console.error("[push] upsert failed:", upErr);
      onError(`No se pudo guardar el token: ${upErr.message}`);
      return false;
    }

    // Backfill: any other orphan rows with user_id=NULL on the same platform
    // should be claimed too (one-shot cleanup of pre-auth registrations).
    await supabase
      .from("device_tokens")
      .update({ user_id: uid, is_active: true, last_seen: new Date().toISOString() })
      .is("user_id", null)
      .eq("platform", platform);

    console.log("[push] token persisted for user", uid);
    onError(null);
    return true;
  } catch (e) {
    console.error("[push] persistToken failed:", e);
    onError(e instanceof Error ? e.message : String(e));
    return false;
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

async function refreshActiveCount(
  setCount: (n: number) => void,
  setRegistered: (b: boolean) => void,
) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setCount(0);
      setRegistered(false);
      return;
    }
    const { count, error } = await supabase
      .from("device_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_active", true);
    if (error) {
      console.warn("[push] refreshActiveCount error:", error);
      return;
    }
    const n = count ?? 0;
    setCount(n);
    setRegistered(n > 0);
  } catch {
    /* ignore */
  }
}

export default useNativePushNotifications;
