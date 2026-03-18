import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSuggestions, type Suggestion } from "@/hooks/useSuggestions";
import { Check, X, Loader2, MessageSquare, Mail, Mic, Sparkles } from "lucide-react";

const TASK_TYPES = ["task_from_plaud", "missing_task", "urgency_alert", "forgotten_followup"];

const priorityLabels: Record<string, { label: string; class: string }> = {
  urgent: { label: "Urgente", class: "bg-destructive/20 text-destructive border-destructive/30" },
  high: { label: "Alta", class: "bg-warning/20 text-warning border-warning/30" },
  medium: { label: "Media", class: "bg-muted text-muted-foreground border-border" },
  low: { label: "Baja", class: "bg-muted text-muted-foreground border-border" },
};

function getSourceIcon(suggestion: Suggestion) {
  const source = suggestion.content?.source || suggestion.suggestion_type;
  if (/whatsapp|wa/i.test(source)) return <MessageSquare className="w-3.5 h-3.5" />;
  if (/email|mail|imap/i.test(source)) return <Mail className="w-3.5 h-3.5" />;
  if (/plaud|transcri/i.test(source)) return <Mic className="w-3.5 h-3.5" />;
  return <Sparkles className="w-3.5 h-3.5" />;
}

function getSourceLabel(suggestion: Suggestion): string {
  const source = suggestion.content?.source || "";
  if (/whatsapp|wa/i.test(source)) return "WhatsApp";
  if (/email|mail|imap/i.test(source)) return "Email";
  if (/plaud|transcri/i.test(source)) return "Plaud";
  return "Auto-detectado";
}

interface SuggestedTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SuggestedTasksDialog = ({ open, onOpenChange }: SuggestedTasksDialogProps) => {
  const { suggestions, accept, reject, loading, refetch } = useSuggestions();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const taskSuggestions = suggestions.filter((s) => TASK_TYPES.includes(s.suggestion_type));

  const handleAccept = async (suggestion: Suggestion) => {
    setProcessingIds((prev) => new Set(prev).add(suggestion.id));
    try {
      await accept(suggestion);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await reject(id);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">TAREAS SUGERIDAS</DialogTitle>
          <DialogDescription>
            Extraídas de WhatsApp, Email y Plaud. Aprueba o descarta cada una.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : taskSuggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay tareas sugeridas pendientes
            </div>
          ) : (
            <div className="space-y-3 pr-2">
              {taskSuggestions.map((s) => {
                const c = s.content;
                const priority = priorityLabels[c.priority || "medium"] || priorityLabels.medium;
                const isProcessing = processingIds.has(s.id);
                const title = c.title || c.description || "Tarea sugerida";
                const context = c.context || c.description || "";

                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border p-4 space-y-2 bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground text-sm leading-tight flex-1">
                        {title}
                      </p>
                      <Badge variant="outline" className={`text-xs shrink-0 ${priority.class}`}>
                        {priority.label}
                      </Badge>
                    </div>

                    {context && context !== title && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{context}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {getSourceIcon(s)}
                        <span>{getSourceLabel(s)}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                          disabled={isProcessing}
                          onClick={() => handleReject(s.id)}
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                          Descartar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-primary text-primary-foreground"
                          disabled={isProcessing}
                          onClick={() => handleAccept(s)}
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export const useTaskSuggestionsCount = () => {
  const { suggestions } = useSuggestions();
  return suggestions.filter((s) => TASK_TYPES.includes(s.suggestion_type)).length;
};
