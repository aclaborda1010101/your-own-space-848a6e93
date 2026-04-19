import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LearnedPattern {
  id: string;
  pattern_type: string;
  pattern_key: string;
  pattern_data: Record<string, any>;
  evidence_count: number;
  confidence: number;
  status: "pending" | "confirmed" | "rejected";
  description: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface SuggestionHealth {
  suggestion_type: string;
  total_count: number;
  accepted_count: number;
  rejected_count: number;
  recent_reject_rate: number;
  threshold_adjustment: number;
  status: "healthy" | "warning" | "degraded";
  last_alert_at: string | null;
}

export interface FeedbackStats {
  totalFeedback: number;
  accepted: number;
  rejected: number;
  corrections: number;
  acceptanceRate: number;
}

export function useJarvisLearning() {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<LearnedPattern[]>([]);
  const [health, setHealth] = useState<SuggestionHealth[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    totalFeedback: 0,
    accepted: 0,
    rejected: 0,
    corrections: 0,
    acceptanceRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [patternsRes, healthRes, feedbackRes] = await Promise.all([
        supabase
          .from("jarvis_learned_patterns")
          .select("*")
          .eq("user_id", user.id)
          .order("evidence_count", { ascending: false })
          .limit(50),
        supabase
          .from("jarvis_suggestion_health")
          .select("*")
          .eq("user_id", user.id)
          .order("total_count", { ascending: false }),
        supabase
          .from("jarvis_feedback")
          .select("feedback_type")
          .eq("user_id", user.id)
          .limit(1000),
      ]);

      setPatterns((patternsRes.data || []) as LearnedPattern[]);
      setHealth((healthRes.data || []) as SuggestionHealth[]);

      const fb = feedbackRes.data || [];
      const accepted = fb.filter((f: any) => f.feedback_type === "suggestion_accept").length;
      const rejected = fb.filter((f: any) => f.feedback_type === "suggestion_reject").length;
      const corrections = fb.filter(
        (f: any) =>
          f.feedback_type === "classification_correct" || f.feedback_type === "priority_change",
      ).length;
      const interactions = accepted + rejected;
      setStats({
        totalFeedback: fb.length,
        accepted,
        rejected,
        corrections,
        acceptanceRate: interactions > 0 ? accepted / interactions : 0,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const confirmPattern = async (id: string) => {
    await supabase
      .from("jarvis_learned_patterns")
      .update({ status: "confirmed", applied_at: new Date().toISOString() })
      .eq("id", id);
    setPatterns((p) =>
      p.map((x) => (x.id === id ? { ...x, status: "confirmed", applied_at: new Date().toISOString() } : x)),
    );
  };

  const rejectPattern = async (id: string) => {
    await supabase
      .from("jarvis_learned_patterns")
      .update({ status: "rejected" })
      .eq("id", id);
    setPatterns((p) => p.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)));
  };

  return {
    patterns,
    health,
    stats,
    loading,
    confirmPattern,
    rejectPattern,
    refetch: fetchAll,
  };
}
