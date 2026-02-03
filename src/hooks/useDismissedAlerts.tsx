import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useDismissedAlerts = () => {
  const { user } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load dismissed alerts from database
  useEffect(() => {
    if (!user) {
      setDismissedIds(new Set());
      setLoading(false);
      return;
    }

    const loadDismissed = async () => {
      try {
        const { data, error } = await supabase
          .from("dismissed_alerts")
          .select("alert_id")
          .eq("user_id", user.id);

        if (error) throw error;

        const ids = new Set((data || []).map((d) => d.alert_id));
        setDismissedIds(ids);
      } catch (error) {
        console.error("Error loading dismissed alerts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDismissed();
  }, [user]);

  const dismissAlert = useCallback(
    async (alertId: string) => {
      if (!user) return;

      // Optimistic update
      setDismissedIds((prev) => new Set([...prev, alertId]));

      try {
        const { error } = await supabase.from("dismissed_alerts").upsert(
          {
            user_id: user.id,
            alert_id: alertId,
          },
          { onConflict: "user_id,alert_id" }
        );

        if (error) throw error;
      } catch (error) {
        console.error("Error dismissing alert:", error);
        // Revert on error
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    },
    [user]
  );

  const isDismissed = useCallback(
    (alertId: string) => dismissedIds.has(alertId),
    [dismissedIds]
  );

  const clearDismissed = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from("dismissed_alerts")
        .delete()
        .eq("user_id", user.id);

      setDismissedIds(new Set());
    } catch (error) {
      console.error("Error clearing dismissed alerts:", error);
    }
  }, [user]);

  return {
    dismissedIds,
    dismissAlert,
    isDismissed,
    clearDismissed,
    loading,
  };
};
