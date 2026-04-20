import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

export interface DebugSnapshot {
  permission: PushPermission;
  registrationAttempted: boolean;
  tokenReceived: boolean;
  tokenSavedToBackend: boolean;
  deviceRegistered: boolean;
  activeDeviceCount: number;
  deviceId: string | null;
  tokenPreview: string | null;
  lastError: string | null;
  lastBackendSyncAt: string | null;
  lastBackendResponse: string | null;
}

export interface NativePushAPI {
  isNative: boolean;
  permission: PushPermission;
  token: string | null;
  registering: boolean;
  deviceRegistered: boolean;
  activeDeviceCount: number;
  error: string | null;
  debug: DebugSnapshot;
  registerDevice: () => Promise<boolean>;
  unregisterDevice: () => Promise<void>;
  refreshActiveDevices: () => Promise<void>;
}

const NativePushContext = createContext<NativePushAPI | null>(null);

function mapPerm(p: string): PushPermission {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

function previewToken(t: string | null): string | null {
  if (!t) return null;
  if (t.length <= 14) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)} (len=${t.length})`;
}

/**
 * Provider único de push notifications nativas. Debe montarse UNA sola vez
 * (en App.tsx) para evitar listeners y estado duplicados.
 */
export function NativePushProvider({ children }: { children: ReactNode }) {
  const isNative = Capacitor.isNativePlatform();

  const [permission, setPermission] = useState<PushPermission>("unknown");
  const [token, setToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [activeDeviceCount, setActiveDeviceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Trazabilidad
  const [registrationAttempted, setRegistrationAttempted] = useState(false);
  const [tokenReceived, setTokenReceived] = useState(false);
  const [tokenSavedToBackend, setTokenSavedToBackend] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lastBackendSyncAt, setLastBackendSyncAt] = useState<string | null>(null);
  const [lastBackendResponse, setLastBackendResponse] = useState<string | null>(null);

  const pendingTokenRef = useRef<string | null>(null);

  // Resolve a stable device id once
  useEffect(() => {
    if (!isNative) return;
    Device.getId()
      .then((d) => setDeviceId(d.identifier ?? null))
      .catch(() => undefined);
  }, [isNative]);

  // Persist token in backend
  const persistToken = useCallback(async (deviceToken: string): Promise<boolean> => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        console.warn("[push] persistToken: no authenticated user");
        setLastBackendResponse("No auth user yet (token buffered)");
        return false;
      }

      let appVersion: string | undefined;
      let deviceModel: string | undefined;
      let osVersion: string | undefined;
      try {
        const info = await Device.getInfo();
        deviceModel = info.model;
        osVersion = info.osVersion;
      } catch { /* ignore */ }
      try {
        const app = await App.getInfo();
        appVersion = app.version;
      } catch { /* ignore */ }

      const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";

      console.log("[push] upsert device_tokens", { uid, platform, tokenPreview: previewToken(deviceToken) });

      const { error: upErr, data: upData } = await supabase
        .from("device_tokens")
        .upsert(
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
        )
        .select("id")
        .maybeSingle();

      if (upErr) {
        console.error("[push] upsert failed:", upErr);
        const msg = `Upsert error (${upErr.code ?? "?"}): ${upErr.message}`;
        setError(msg);
        setLastBackendResponse(msg);
        setTokenSavedToBackend(false);
        return false;
      }

      // Reclaim other orphan rows (user_id NULL) on same platform
      const { error: claimErr } = await supabase
        .from("device_tokens")
        .update({ user_id: uid, is_active: true, last_seen: new Date().toISOString() })
        .is("user_id", null)
        .eq("platform", platform);
      if (claimErr) {
        console.warn("[push] orphan claim warning:", claimErr.message);
      }

      console.log("[push] token persisted, row id =", upData?.id);
      setError(null);
      setTokenSavedToBackend(true);
      setLastBackendSyncAt(new Date().toISOString());
      setLastBackendResponse(`OK row=${upData?.id ?? "unknown"}`);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[push] persistToken exception:", msg);
      setError(msg);
      setLastBackendResponse(`Exception: ${msg}`);
      setTokenSavedToBackend(false);
      return false;
    }
  }, []);

  const refreshActiveCount = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setActiveDeviceCount(0);
        setDeviceRegistered(false);
        return;
      }
      const { count, error: countErr } = await supabase
        .from("device_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("is_active", true);
      if (countErr) {
        console.warn("[push] refreshActiveCount error:", countErr);
        setLastBackendResponse(`Read error: ${countErr.message}`);
        return;
      }
      const n = count ?? 0;
      setActiveDeviceCount(n);
      setDeviceRegistered(n > 0);
      setLastBackendSyncAt(new Date().toISOString());
      console.log("[push] active devices for user =", n);
    } catch {
      /* ignore */
    }
  }, []);

  // Initial permission check
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await PushNotifications.checkPermissions();
        if (!cancelled) setPermission(mapPerm(status.receive));
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  // Auth state: on login flush pending token + refresh count
  useEffect(() => {
    void refreshActiveCount();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user && pendingTokenRef.current) {
        const t = pendingTokenRef.current;
        pendingTokenRef.current = null;
        console.log("[push] auth ready, flushing pending token");
        await persistToken(t);
      }
      await refreshActiveCount();
    });
    return () => sub.subscription.unsubscribe();
  }, [persistToken, refreshActiveCount]);

  // Native listeners — single instance for the whole app
  useEffect(() => {
    if (!isNative) return;
    const subs: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      const onRegistration = await PushNotifications.addListener("registration", async (t: Token) => {
        console.log("[push] registration token received:", previewToken(t.value));
        setToken(t.value);
        setTokenReceived(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          console.warn("[push] no auth user yet — buffering token");
          pendingTokenRef.current = t.value;
          setLastBackendResponse("Token recibido, esperando auth para guardar");
          return;
        }
        const ok = await persistToken(t.value);
        if (ok) await refreshActiveCount();
      });
      subs.push(onRegistration);

      const onError = await PushNotifications.addListener("registrationError", (err) => {
        console.error("[push] registrationError:", err);
        setError(err.error ?? "Push registration error");
        setLastBackendResponse(`registrationError: ${err.error ?? "unknown"}`);
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
            try { window.location.assign(route); } catch { /* noop */ }
          }
        },
      );
      subs.push(onAction);

      const onResume = await App.addListener("resume", async () => {
        await refreshActiveCount();
      });
      subs.push(onResume);
    })();

    return () => {
      subs.forEach((s) => s.remove().catch(() => undefined));
    };
  }, [isNative, persistToken, refreshActiveCount]);

  const registerDevice = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    setRegistering(true);
    setRegistrationAttempted(true);
    setError(null);
    setLastBackendResponse("Solicitando permisos…");
    try {
      const status = await PushNotifications.requestPermissions();
      const mapped = mapPerm(status.receive);
      setPermission(mapped);
      console.log("[push] permission status:", mapped);
      if (mapped !== "granted") {
        setLastBackendResponse(`Permiso: ${mapped}`);
        return false;
      }
      console.log("[push] calling PushNotifications.register()");
      setLastBackendResponse("Permiso concedido, llamando register()…");
      await PushNotifications.register();
      // Token llegará vía listener
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[push] registerDevice error:", msg);
      setError(msg);
      setLastBackendResponse(`register() exception: ${msg}`);
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
      setTokenSavedToBackend(false);
      await refreshActiveCount();
    } catch (e) {
      console.warn("[push] unregister failed:", e);
    }
  }, [token, refreshActiveCount]);

  const refreshActiveDevices = useCallback(async () => {
    await refreshActiveCount();
  }, [refreshActiveCount]);

  const debug: DebugSnapshot = {
    permission,
    registrationAttempted,
    tokenReceived,
    tokenSavedToBackend,
    deviceRegistered,
    activeDeviceCount,
    deviceId,
    tokenPreview: previewToken(token),
    lastError: error,
    lastBackendSyncAt,
    lastBackendResponse,
  };

  const value: NativePushAPI = {
    isNative,
    permission,
    token,
    registering,
    deviceRegistered,
    activeDeviceCount,
    error,
    debug,
    registerDevice,
    unregisterDevice,
    refreshActiveDevices,
  };

  return <NativePushContext.Provider value={value}>{children}</NativePushContext.Provider>;
}

export function useNativePushNotifications(): NativePushAPI {
  const ctx = useContext(NativePushContext);
  if (ctx) return ctx;
  // Fallback no-op (cuando se usa fuera del provider, p.ej. login). Evita crash.
  return {
    isNative: Capacitor.isNativePlatform(),
    permission: "unknown",
    token: null,
    registering: false,
    deviceRegistered: false,
    activeDeviceCount: 0,
    error: null,
    debug: {
      permission: "unknown",
      registrationAttempted: false,
      tokenReceived: false,
      tokenSavedToBackend: false,
      deviceRegistered: false,
      activeDeviceCount: 0,
      deviceId: null,
      tokenPreview: null,
      lastError: "Provider no montado",
      lastBackendSyncAt: null,
      lastBackendResponse: null,
    },
    registerDevice: async () => false,
    unregisterDevice: async () => undefined,
    refreshActiveDevices: async () => undefined,
  };
}

export default useNativePushNotifications;
