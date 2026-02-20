import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Suggestion {
  id: string;
  suggestion_type: string;
  content: Record<string, any>;
  status: string;
  source_transcription_id: string | null;
  created_at: string;
}

const PRIORITY_MAP: Record<string, string> = {
  urgent: "P0",
  high: "P1",
  medium: "P2",
  low: "P3",
};

function detectTaskType(content: Record<string, any>): "work" | "life" | "finance" {
  const text = JSON.stringify(content).toLowerCase();
  if (/finanz|dinero|pago|factura|presupuesto|cobr/.test(text)) return "finance";
  if (/familia|hijo|bosco|personal|casa|médico/.test(text)) return "life";
  return "work";
}

export const useSuggestions = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSuggestions((data || []) as Suggestion[]);
    } catch (e: any) {
      console.error("Error fetching suggestions:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const acceptTask = async (suggestion: Suggestion) => {
    if (!user) return;
    const c = suggestion.content;
    const priority = PRIORITY_MAP[c.priority || "medium"] || "P2";
    const taskType = detectTaskType(c);

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: c.title || c.description || "Tarea de Plaud",
      type: taskType,
      priority,
      duration: c.duration || 30,
      completed: false,
    });
    if (error) throw error;
  };

  const acceptEvent = async (suggestion: Suggestion, eventDate?: string, onCreateEvent?: (data: { title: string; date: string }) => Promise<void>) => {
    const c = suggestion.content;
    const date = eventDate || c.date || c.event_date;
    if (!date) throw new Error("No se proporcionó fecha para el evento");
    if (onCreateEvent) {
      await onCreateEvent({ title: c.title || c.description || "Evento de Plaud", date });
    }
  };

  const acceptOpportunity = async (suggestion: Suggestion) => {
    if (!user) return;
    const c = suggestion.content;

    const { error } = await supabase.from("business_projects").insert({
      user_id: user.id,
      name: c.title || c.description || "Oportunidad de Plaud",
      status: "nuevo",
      need_summary: c.need_summary || c.description || null,
      estimated_value: c.estimated_value || null,
      origin: "plaud",
    });
    if (error) throw error;
  };

  const acceptContact = async (suggestion: Suggestion) => {
    if (!user) return;
    const c = suggestion.content;

    const { error } = await supabase.from("people_contacts").insert({
      user_id: user.id,
      name: c.name || "Contacto de Plaud",
      company: c.company || null,
      role: c.role || null,
      email: c.email || null,
      phone: c.phone || null,
      brain: "profesional",
    });
    if (error) throw error;
  };

  const accept = async (suggestion: Suggestion, eventDate?: string, onCreateEvent?: (data: { title: string; date: string }) => Promise<void>) => {
    try {
      switch (suggestion.suggestion_type) {
        case "task_from_plaud":
          await acceptTask(suggestion);
          break;
        case "event_from_plaud":
          await acceptEvent(suggestion, eventDate, onCreateEvent);
          break;
        case "opportunity_from_plaud":
          await acceptOpportunity(suggestion);
          break;
        case "contact_from_plaud":
          await acceptContact(suggestion);
          break;
      }

      await supabase
        .from("suggestions")
        .update({ status: "accepted" })
        .eq("id", suggestion.id);

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      toast.success("Sugerencia aceptada");
    } catch (e: any) {
      console.error("Error accepting suggestion:", e);
      toast.error("Error al aceptar sugerencia");
    }
  };

  const reject = async (id: string) => {
    try {
      await supabase
        .from("suggestions")
        .update({ status: "rejected" })
        .eq("id", id);

      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Sugerencia descartada");
    } catch (e: any) {
      console.error("Error rejecting suggestion:", e);
      toast.error("Error al descartar sugerencia");
    }
  };

  return {
    suggestions,
    loading,
    pendingCount: suggestions.length,
    accept,
    reject,
    refetch: fetchSuggestions,
  };
};
