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
  confidence?: number | null;
  reasoning?: string | null;
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

  // Confirm a Plaud classification: link transcription to project, create timeline entry
  const acceptClassification = async (suggestion: Suggestion, overrideProjectId?: string) => {
    if (!user) return;
    const c = suggestion.content;
    const projectId = overrideProjectId || c.project_id;
    const transcriptionId = c.transcription_id || suggestion.source_transcription_id;
    const contactIds = (c.contacts || [])
      .filter((x: any) => x?.id)
      .map((x: any) => x.id);

    if (transcriptionId) {
      const update: Record<string, any> = {};
      if (projectId) update.linked_project_id = projectId;
      if (contactIds.length > 0) update.linked_contact_ids = contactIds;
      if (Object.keys(update).length > 0) {
        await supabase.from("plaud_transcriptions").update(update).eq("id", transcriptionId);
      }
    }

    if (projectId && transcriptionId && !c.auto_linked_project) {
      await supabase.from("business_project_timeline").insert({
        project_id: projectId,
        user_id: user.id,
        channel: "plaud",
        title: c.title || "Grabación Plaud",
        description: c.summary_one_line || c.excerpt?.slice(0, 280) || "",
        event_date: c.recording_date || new Date().toISOString(),
        auto_detected: false,
        source_id: transcriptionId,
        importance_score: Math.round((c.project_confidence || 0.5) * 100),
      });
    }
  };

  const accept = async (
    suggestion: Suggestion,
    eventDate?: string,
    onCreateEvent?: (data: { title: string; date: string }) => Promise<void>,
    overrideProjectId?: string,
  ) => {
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
        case "classification_from_plaud":
          await acceptClassification(suggestion, overrideProjectId);
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
