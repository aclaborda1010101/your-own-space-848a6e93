import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Heart, Zap, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SuggestedResponse {
  id: string;
  suggestion_1: string | null;
  suggestion_2: string | null;
  suggestion_3: string | null;
  context_summary: string | null;
  status: string;
  created_at: string;
}

interface SuggestedResponsesProps {
  contactId: string;
  contactName: string;
}

const SuggestedResponses = ({ contactId, contactName }: SuggestedResponsesProps) => {
  const [responses, setResponses] = useState<SuggestedResponse[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch pending suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await (supabase as any)
        .from("suggested_responses")
        .select("id, suggestion_1, suggestion_2, suggestion_3, context_summary, status, created_at")
        .eq("contact_id", contactId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setResponses(data);
    };

    fetchSuggestions();

    // Subscribe to realtime inserts
    const channel = supabase
      .channel(`suggested_responses_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "suggested_responses",
          filter: `contact_id=eq.${contactId}`,
        },
        (payload: any) => {
          if (payload.new?.status === "pending") {
            setResponses((prev) => [payload.new as SuggestedResponse, ...prev].slice(0, 3));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  const handleCopy = async (text: string, id: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(`${id}-${type}`);
    toast.success("Respuesta copiada al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAccept = async (id: string, text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    await (supabase as any)
      .from("suggested_responses")
      .update({ status: "accepted" })
      .eq("id", id);
    setResponses((prev) => prev.filter((r) => r.id !== id));
    toast.success("Respuesta aceptada y copiada");
  };

  const handleDismiss = async (id: string) => {
    await (supabase as any)
      .from("suggested_responses")
      .update({ status: "rejected" })
      .eq("id", id);
    setResponses((prev) => prev.filter((r) => r.id !== id));
  };

  if (responses.length === 0) return null;

  const suggestions = [
    { key: "suggestion_1" as const, icon: Briefcase, label: "Estratégica", color: "text-blue-500" },
    { key: "suggestion_2" as const, icon: Heart, label: "Empática", color: "text-pink-500" },
    { key: "suggestion_3" as const, icon: Zap, label: "Ejecutiva", color: "text-amber-500" },
  ];

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          💡 Respuestas Sugeridas
        </h4>
        {responses.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => responses.forEach((r) => handleDismiss(r.id))}
          >
            <X className="w-3 h-3 mr-1" /> Descartar
          </Button>
        )}
      </div>

      {responses.slice(0, 1).map((response) => (
        <div key={response.id} className="space-y-2">
          {suggestions.map(({ key, icon: Icon, label, color }) => {
            const text = response[key];
            if (!text) return null;
            const isCopied = copiedId === `${response.id}-${key}`;

            return (
              <div
                key={key}
                className="group flex items-start gap-2 p-2.5 rounded-md bg-background/80 border border-border/30 hover:border-border/60 cursor-pointer transition-all"
                onClick={() => handleAccept(response.id, text, key)}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{label}</span>
                  <p className="text-sm text-foreground leading-snug">{text}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(text, response.id, key);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default SuggestedResponses;
