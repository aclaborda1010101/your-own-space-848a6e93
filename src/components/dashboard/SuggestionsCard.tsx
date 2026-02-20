import { useState } from "react";
import { useSuggestions, Suggestion } from "@/hooks/useSuggestions";
import { useCalendar } from "@/hooks/useCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  X,
  ListTodo,
  CalendarPlus,
  Briefcase,
  UserPlus,
  Loader2,
  Sparkles,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: typeof ListTodo; label: string; color: string }> = {
  task_from_plaud: { icon: ListTodo, label: "Tarea", color: "text-blue-500" },
  event_from_plaud: { icon: CalendarPlus, label: "Evento", color: "text-green-500" },
  opportunity_from_plaud: { icon: Briefcase, label: "Oportunidad", color: "text-amber-500" },
  contact_from_plaud: { icon: UserPlus, label: "Contacto", color: "text-purple-500" },
};

function SuggestionItem({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: (s: Suggestion, date?: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [eventDate, setEventDate] = useState(
    suggestion.content?.date || suggestion.content?.event_date || ""
  );
  const config = TYPE_CONFIG[suggestion.suggestion_type] || TYPE_CONFIG.task_from_plaud;
  const Icon = config.icon;
  const c = suggestion.content;
  const title = c?.title || c?.description || c?.name || "Sugerencia";
  const needsDate =
    suggestion.suggestion_type === "event_from_plaud" && !c?.date && !c?.event_date;

  const handleAccept = async () => {
    setBusy(true);
    try {
      await onAccept(suggestion, eventDate || undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(suggestion.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {config.label}
            </Badge>
            {c?.priority && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {c.priority}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">{title}</p>
          {c?.description && c.description !== title && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
          )}
        </div>
      </div>

      {needsDate && (
        <Input
          type="datetime-local"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="text-xs h-8"
          placeholder="Selecciona fecha y hora"
        />
      )}

      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={handleReject}
          disabled={busy}
        >
          <X className="w-3 h-3 mr-1" />
          Descartar
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleAccept}
          disabled={busy || (needsDate && !eventDate)}
        >
          {busy ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3 mr-1" />
          )}
          Confirmar
        </Button>
      </div>
    </div>
  );
}

export const SuggestionsCard = () => {
  const { suggestions, loading, accept, reject } = useSuggestions();
  const { createEvent } = useCalendar();

  const handleAccept = async (suggestion: Suggestion, eventDate?: string) => {
    const onCreateEvent = async (data: { title: string; date: string }) => {
      const time = data.date.includes("T") ? data.date.split("T")[1].substring(0, 5) : "09:00";
      await createEvent({ title: data.title, date: data.date.split("T")[0], time, duration: 60 });
    };
    await accept(suggestion, eventDate, onCreateEvent);
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Sugerencias de Plaud
          <Badge variant="secondary" className="ml-auto text-xs">
            {suggestions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s) => (
          <SuggestionItem
            key={s.id}
            suggestion={s}
            onAccept={handleAccept}
            onReject={reject}
          />
        ))}
      </CardContent>
    </Card>
  );
};
