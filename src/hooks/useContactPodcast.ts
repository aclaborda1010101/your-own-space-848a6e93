import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PodcastRow {
  id: string;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  format: "narrator" | "dialogue";
  total_segments: number;
  last_message_count: number;
  total_duration_seconds: number;
  last_generated_at: string | null;
  error_message: string | null;
}

export interface PodcastSegment {
  id: string;
  segment_number: number;
  message_range_start: number;
  message_range_end: number;
  message_count: number;
  format: string;
  audio_storage_path: string;
  duration_seconds: number;
  generated_at: string;
  signedUrl?: string;
}

export function useContactPodcast(contactId: string | null) {
  const [podcast, setPodcast] = useState<PodcastRow | null>(null);
  const [segment, setSegment] = useState<PodcastSegment | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id;
      if (!userId) return;

      const { data: pod } = await supabase
        .from("contact_podcasts")
        .select("*")
        .eq("contact_id", contactId)
        .eq("user_id", userId)
        .maybeSingle();
      setPodcast((pod as PodcastRow) || null);

      if (pod) {
        // Single audio: pick the latest segment (segment_number=1 by design)
        const { data: segs } = await supabase
          .from("contact_podcast_segments")
          .select("*")
          .eq("podcast_id", pod.id)
          .order("segment_number", { ascending: false })
          .limit(1);

        const s = (segs as PodcastSegment[] | null)?.[0];
        if (s) {
          const { data: signedRes } = await supabase.storage
            .from("contact-podcasts")
            .createSignedUrl(s.audio_storage_path, 3600);
          setSegment({ ...s, signedUrl: signedRes?.signedUrl });
        } else {
          setSegment(null);
        }
      } else {
        setSegment(null);
      }
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while generating
  useEffect(() => {
    if (!podcast) return;
    if (podcast.status === "generating" || podcast.status === "queued") {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(load, 5000);
      return () => {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    } else if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [podcast, load]);

  const regenerate = useCallback(
    async (opts: { format?: "narrator" | "dialogue" } = {}) => {
      if (!contactId) return;
      setBusy(true);
      try {
        const { error } = await supabase.functions.invoke(
          "generate-contact-podcast-segment",
          {
            body: {
              contactId,
              format: opts.format,
              force_full_regenerate: true,
            },
          },
        );
        if (error) throw error;
        toast.success("Generando podcast de la relación…");
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error generando");
      } finally {
        setBusy(false);
      }
    },
    [contactId, load],
  );

  const setFormat = useCallback(
    async (format: "narrator" | "dialogue") => {
      if (!podcast) return;
      await supabase
        .from("contact_podcasts")
        .update({ format })
        .eq("id", podcast.id);
      setPodcast({ ...podcast, format });
    },
    [podcast],
  );

  return {
    podcast,
    segment,
    loading,
    busy,
    refresh: load,
    regenerate,
    setFormat,
  };
}
