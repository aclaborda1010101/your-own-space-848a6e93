import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SignalSuggestion {
  id: string;
  user_id: string;
  suggestion_type: string;
  content: Record<string, any>;
  status: string;
  source: string | null;
  confidence: number | null;
  reasoning: string | null;
  contact_id: string | null;
  source_message_ids: string[] | null;
  signature: string | null;
  created_at: string;
}

const SIGNAL_TYPES = [
  "task_from_signal",
  "meeting_from_signal",
  "followup_from_signal",
  "outreach_from_signal",
];

export const useSignalSuggestions = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SignalSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("suggestions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("suggestion_type", SIGNAL_TYPES)
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetch signal suggestions", error);
    } else {
      setItems((data ?? []) as SignalSuggestion[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const logFeedback = async (s: SignalSuggestion, decision: "accepted" | "rejected" | "snoozed", reason?: string) => {
    if (!user) return;
    await supabase.from("suggestion_feedback").insert({
      user_id: user.id,
      suggestion_id: s.id,
      suggestion_type: s.suggestion_type,
      source: s.source,
      contact_id: s.contact_id,
      decision,
      confidence_at_decision: s.confidence,
      reasoning_snapshot: s.reasoning,
      signature: s.signature,
      reason_text: reason ?? null,
    });
  };

  const accept = async (s: SignalSuggestion) => {
    if (!user) return;
    try {
      const c = s.content || {};
      // Todos los tipos de señal aceptados se materializan como tareas en el inbox
      // del usuario. Las reuniones se marcan con prefijo y fecha para que el usuario
      // las pase manualmente al calendario externo (iCloud/Google) si quiere.
      const priorityMap: Record<string, string> = { urgent: "P0", high: "P1", medium: "P2", low: "P3" };
      const isMeeting = s.suggestion_type === "meeting_from_signal";
      const titlePrefix = isMeeting ? "📅 " : s.suggestion_type === "outreach_from_signal" ? "📞 " : "";
      const dateSuffix = isMeeting && c.date ? ` — ${new Date(c.date).toLocaleString("es-ES")}` : "";
      await supabase.from("tasks").insert({
        user_id: user.id,
        title: `${titlePrefix}${c.title || "Sugerencia aceptada"}${dateSuffix}`,
        type: "work",
        priority: priorityMap[c.priority || "medium"] || "P2",
        duration: isMeeting ? 60 : 30,
        completed: false,
      });
      await supabase.from("suggestions").update({ status: "accepted" }).eq("id", s.id);
      await logFeedback(s, "accepted");
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Sugerencia aceptada");
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo aceptar");
    }
  };

  const reject = async (s: SignalSuggestion, reason?: string) => {
    try {
      await supabase.from("suggestions").update({ status: "rejected" }).eq("id", s.id);
      await logFeedback(s, "rejected", reason);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Descartada — JARVIS aprende de esto");
    } catch (e: any) {
      toast.error("Error al descartar");
    }
  };

  const scanNow = async (opts?: { contact_id?: string; force?: boolean; threshold?: number }) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-task-signals", { body: opts ?? {} });
      if (error) throw error;
      toast.success(`Escaneo completado: ${data?.created ?? 0} nuevas sugerencias`);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al escanear: " + (e.message ?? e));
    } finally {
      setScanning(false);
    }
  };

  return { items, loading, scanning, accept, reject, scanNow, refetch: fetchAll };
};
