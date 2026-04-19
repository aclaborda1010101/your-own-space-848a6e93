import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";
import { supabase } from "@/integrations/supabase/client";

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt: string; // ISO
}

export type GeolocationSource = "manual" | "jarvis_query" | "task_geofence";

interface UseGeolocationResult {
  isNative: boolean;
  permission: "granted" | "denied" | "prompt" | "unknown";
  lastLocation: UserLocation | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  getCurrentPosition: (opts?: {
    persist?: boolean;
    source?: GeolocationSource;
    context?: string;
  }) => Promise<UserLocation | null>;
  watchPosition: (cb: (loc: UserLocation) => void) => Promise<string | null>;
  clearWatch: (id: string) => Promise<void>;
}

/**
 * Hook unificado de geolocalización.
 * - En iOS/Android nativo usa @capacitor/geolocation (CoreLocation/FusedLocation).
 * - En web cae a navigator.geolocation.
 * - Cuando se pide `persist: true`, guarda la captura en `user_location_history`.
 */
export function useGeolocation(): UseGeolocationResult {
  const isNative = Capacitor.isNativePlatform();
  const [permission, setPermission] = useState<UseGeolocationResult["permission"]>("unknown");
  const [lastLocation, setLastLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comprueba permisos en mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isNative) {
          const status = await Geolocation.checkPermissions();
          if (cancelled) return;
          setPermission(mapNativePerm(status.location));
        } else if ("permissions" in navigator) {
          // @ts-expect-error: PermissionName 'geolocation' is widely supported
          const res = await navigator.permissions.query({ name: "geolocation" });
          if (cancelled) return;
          setPermission(res.state as UseGeolocationResult["permission"]);
        }
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      if (isNative) {
        const status = await Geolocation.requestPermissions({ permissions: ["location"] });
        const mapped = mapNativePerm(status.location);
        setPermission(mapped);
        return mapped === "granted";
      }
      // Web: el permiso se pide implícitamente en el primer getCurrentPosition
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [isNative]);

  const persistLocation = useCallback(
    async (loc: UserLocation, source: GeolocationSource, context?: string) => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        await supabase.from("user_location_history").insert({
          user_id: uid,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy ?? null,
          altitude: loc.altitude ?? null,
          heading: loc.heading ?? null,
          speed: loc.speed ?? null,
          source,
          context: context ?? null,
          captured_at: loc.capturedAt,
        });
      } catch (e) {
        console.warn("[useGeolocation] persist failed:", e);
      }
    },
    [],
  );

  const getCurrentPosition: UseGeolocationResult["getCurrentPosition"] = useCallback(
    async (opts) => {
      setLoading(true);
      setError(null);
      try {
        let pos: Position | GeolocationPosition;
        if (isNative) {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15_000,
          });
        } else {
          pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!("geolocation" in navigator)) {
              reject(new Error("Geolocation not supported"));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15_000,
              maximumAge: 0,
            });
          });
        }
        const loc = positionToLocation(pos);
        setLastLocation(loc);
        setPermission("granted");
        if (opts?.persist) {
          await persistLocation(loc, opts.source ?? "manual", opts.context);
        }
        return loc;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (/denied/i.test(msg)) setPermission("denied");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isNative, persistLocation],
  );

  const watchPosition: UseGeolocationResult["watchPosition"] = useCallback(
    async (cb) => {
      try {
        if (isNative) {
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15_000 },
            (pos, err) => {
              if (err || !pos) return;
              const loc = positionToLocation(pos);
              setLastLocation(loc);
              cb(loc);
            },
          );
          return id;
        }
        if (!("geolocation" in navigator)) return null;
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const loc = positionToLocation(pos);
            setLastLocation(loc);
            cb(loc);
          },
          (err) => setError(err.message),
          { enableHighAccuracy: true },
        );
        return String(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [isNative],
  );

  const clearWatch: UseGeolocationResult["clearWatch"] = useCallback(
    async (id) => {
      try {
        if (isNative) {
          await Geolocation.clearWatch({ id });
        } else if ("geolocation" in navigator) {
          navigator.geolocation.clearWatch(Number(id));
        }
      } catch {
        // silent
      }
    },
    [isNative],
  );

  return {
    isNative,
    permission,
    lastLocation,
    loading,
    error,
    requestPermission,
    getCurrentPosition,
    watchPosition,
    clearWatch,
  };
}

function mapNativePerm(p: string): UseGeolocationResult["permission"] {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

function positionToLocation(pos: Position | GeolocationPosition): UserLocation {
  const c = pos.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy,
    altitude: c.altitude,
    heading: c.heading,
    speed: c.speed,
    capturedAt: new Date(pos.timestamp ?? Date.now()).toISOString(),
  };
}

export default useGeolocation;
