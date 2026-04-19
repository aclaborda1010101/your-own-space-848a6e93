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

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[notif-prefs] load:", error);
    }

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
      // Crea registro con defaults
      await supabase.from("notification_preferences").insert({
        user_id: user.id,
        ...DEFAULTS,
      });
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user?.id) return;
      setSaving(true);
      const next = { ...prefs, ...patch };
      setPrefs(next);
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (error) console.warn("[notif-prefs] save:", error);
      setSaving(false);
    },
    [prefs, user?.id],
  );

  return { prefs, loading, saving, update, reload: load };
}

export default useNotificationPreferences;
