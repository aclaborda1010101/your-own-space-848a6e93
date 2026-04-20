import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HeadlinesPayload {
  health: {
    score: number;
    label: string;
    relationship_type: string;
    trend: string;
  };
  pending: {
    title: string;
    who_owes: string;
    last_mentioned: string;
    is_event?: boolean;
    event_date?: string | null;
    expires_at?: string | null;
    freshness_status?: "active" | "expiring" | "expired" | "stale";
  };
  topics: {
    tone_emoji: string;
    tone_label: string;
    top_topics: { name: string; percentage: number }[];
    tone_evolution: string;
  };
}

export function useContactHeadlines(contactId: string | null) {
  const [payload, setPayload] = useState<HeadlinesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshedFor = useRef<string | null>(null);

  const fetchHeadlines = useCallback(
    async (force = false) => {
      if (!contactId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-contact-headlines",
          { body: { contactId, force } },
        );
        if (error) throw error;
        if (data?.payload) setPayload(data.payload as HeadlinesPayload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [contactId],
  );

  useEffect(() => {
    autoRefreshedFor.current = null;
    fetchHeadlines();
  }, [fetchHeadlines]);

  // Auto-refresh once per contact load when we detect a stale/expired cache,
  // so the user never sees a frozen "Sin asunto vivo" headline indefinitely.
  useEffect(() => {
    if (!payload || !contactId) return;
    if (autoRefreshedFor.current === contactId) return;
    const fresh = payload.pending?.freshness_status;
    if (fresh === "stale" || fresh === "expired") {
      autoRefreshedFor.current = contactId;
      void fetchHeadlines(true);
    }
  }, [payload, contactId, fetchHeadlines]);

  return { payload, loading, error, refresh: () => fetchHeadlines(true) };
}
