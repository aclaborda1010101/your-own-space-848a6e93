import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimelinePoint {
  date: string;
  sentiment: number;
  title: string;
  description?: string;
  kind: "relationship" | "personal";
  source: string;
  category?: string;
  total?: number;
}

export interface TimelineData {
  relationship_events: TimelinePoint[];
  relationship_frequency: TimelinePoint[];
  personal_events: TimelinePoint[];
  range: { start: string | null; end: string | null };
  cached?: boolean;
}

export function useRelationshipTimeline(contactId: string | undefined) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!contactId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: result, error: invokeErr } = await supabase.functions.invoke(
          "build-relationship-timeline",
          { body: { contact_id: contactId, force_refresh: forceRefresh } }
        );
        if (invokeErr) throw invokeErr;
        setData(result as TimelineData);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [contactId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
