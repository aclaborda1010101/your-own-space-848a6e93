import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PlaudSuggestion {
  project: {
    id: string;
    name: string;
    confidence: number;
    reasoning: string;
  } | null;
  contacts: { id: string; name: string; confidence: number }[];
  context_type: "professional" | "family" | "personal";
  summary_one_line: string;
  auto_assign: boolean;
  auto_assign_pattern_id: string | null;
  learned_patterns_used: { pattern_id: string; project_id: string; evidence: number }[];
}

interface State {
  loading: boolean;
  error: string | null;
  data: PlaudSuggestion | null;
}

/**
 * Pide sugerencia inicial al edge function plaud-suggest-initial.
 * Se invoca manualmente desde el componente con el título + extracto del transcript.
 */
export function usePlaudImportSuggestions() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ loading: false, error: null, data: null });
  const reqIdRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (title: string, transcriptExcerpt: string) => {
      if (!user) return;
      const myReq = ++reqIdRef.current;
      setState({ loading: true, error: null, data: null });
      try {
        const { data, error } = await supabase.functions.invoke("plaud-suggest-initial", {
          body: {
            user_id: user.id,
            title,
            transcript_excerpt: transcriptExcerpt,
          },
        });
        if (reqIdRef.current !== myReq) return; // stale
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Sin sugerencias");
        setState({ loading: false, error: null, data: data as PlaudSuggestion });
      } catch (e: any) {
        if (reqIdRef.current !== myReq) return;
        setState({ loading: false, error: e?.message || "Error", data: null });
      }
    },
    [user],
  );

  const reset = useCallback(() => {
    reqIdRef.current++;
    setState({ loading: false, error: null, data: null });
  }, []);

  return { ...state, fetchSuggestions, reset };
}
