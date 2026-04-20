import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationPreferences {
  enabled: boolean;
  tasks_enabled: boolean;
  calendar_enabled: boolean;
  jarvis_enabled: boolean;
  plaud_enabled: boolean;
  calendar_lead_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM
  quiet_hours_end: string;   // HH:MM
  timezone: string;
}

const DEFAULTS: NotificationPreferences = {
  enabled: true,
  tasks_enabled: true,
  calendar_enabled: true,
  jarvis_enabled: true,
  plaud_enabled: true,
  calendar_lead_minutes: 15,
  quiet_hours_enabled: true,
  quiet_hours_start: "23:00",
  quiet_hours_end: "08:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
};

const LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout (${ms}ms) en ${label}`)), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export function useNotificationPreferences() {
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // While auth is still resolving, don't keep the spinner forever — show defaults.
    if (authLoading) {
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await withTimeout(
        supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        LOAD_TIMEOUT_MS,
        "load notification_preferences",
      );

      if (dbErr) throw dbErr;

      if (data) {
        setPrefs({
          enabled: data.enabled,
          tasks_enabled: data.tasks_enabled,
          calendar_enabled: data.calendar_enabled,
          jarvis_enabled: data.jarvis_enabled,
          plaud_enabled: data.plaud_enabled,
          calendar_lead_minutes: data.calendar_lead_minutes,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          timezone: data.timezone,
        });
      } else {
        // Try to create row with defaults — ignore failures (RLS / offline).
        try {
          await withTimeout(
            supabase.from("notification_preferences").insert({
              user_id: user.id,
              ...DEFAULTS,
            }),
            LOAD_TIMEOUT_MS,
            "insert default notification_preferences",
          );
        } catch (insertErr) {
          console.warn("[notif-prefs] insert defaults failed:", insertErr);
        }
        setPrefs(DEFAULTS);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[notif-prefs] load failed:", msg);
      setError(msg);
      // Keep DEFAULTS so UI can still render and the user can interact.
      setPrefs((prev) => prev ?? DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user?.id) return;
      setSaving(true);
      const next = { ...prefs, ...patch };
      setPrefs(next);
      try {
        const { error: dbErr } = await withTimeout(
          supabase
            .from("notification_preferences")
            .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" }),
          LOAD_TIMEOUT_MS,
          "save notification_preferences",
        );
        if (dbErr) {
          console.warn("[notif-prefs] save:", dbErr);
          setError(dbErr.message);
        } else {
          setError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[notif-prefs] save failed:", msg);
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [prefs, user?.id],
  );

  return { prefs, loading, saving, error, update, reload: load };
}

export default useNotificationPreferences;
