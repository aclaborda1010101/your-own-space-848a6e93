import { useState, useEffect } from "react";
import { useSuggestions, Suggestion } from "@/hooks/useSuggestions";
import { useCalendar } from "@/hooks/useCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  X,
  ListTodo,
  CalendarPlus,
  Briefcase,
  UserPlus,
  Loader2,
  Sparkles,
  Target,
  Users,
  Mic,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: typeof ListTodo; label: string; color: string }> = {
  task_from_plaud: { icon: ListTodo, label: "Tarea", color: "text-blue-500" },
  event_from_plaud: { icon: CalendarPlus, label: "Evento", color: "text-green-500" },
  opportunity_from_plaud: { icon: Briefcase, label: "Oportunidad", color: "text-amber-500" },
  contact_from_plaud: { icon: UserPlus, label: "Contacto", color: "text-purple-500" },
  classification_from_plaud: { icon: Target, label: "Clasificación Plaud", color: "text-primary" },
};

function ClassificationItem({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: (s: Suggestion, date?: string, overrideProjectId?: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const c = suggestion.content;
  const [projectId, setProjectId] = useState<string>(c.project_id || "");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("business_projects")
      .select("id, name")
      .eq("user_id", user.id)
      .neq("status", "closed")
      .order("updated_at", { ascending: false })
      .limit(60)
      .then(({ data }) => setProjects(data || []));
  }, [user]);

  const confidence = Math.round((c.project_confidence || 0) * 100);
  const confColor =
    confidence >= 80 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" :
    confidence >= 50 ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
    "bg-muted text-muted-foreground border-border";

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onAccept(suggestion, undefined, projectId || undefined);
    } finally { setBusy(false); }
  };

  const handleReject = async () => {
    setBusy(true);
    try { await onReject(suggestion.id); } finally { setBusy(false); }
  };

  const resolvedContacts = (c.contacts || []).filter((x: any) => x?.id || x?.name);

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
      <div className="flex items-start gap-2">
        <Mic className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
              Clasificación Plaud
            </Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${confColor}`}>
              {confidence}% confianza
            </Badge>
            {c.auto_linked_project && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Auto-asignado
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-1">
            {c.title || "Grabación sin título"}
          </p>
          {c.summary_one_line && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">"{c.summary_one_line}"</p>
          )}
          {c.excerpt && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 font-mono">
              {c.excerpt}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Proyecto sugerido
          </label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder={c.project_name_suggested ? `Crear: ${c.project_name_suggested}` : "Sin proyecto"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {c.project_name && c.project_id && (
            <p className="text-[10px] text-muted-foreground mt-1">
              IA propone: <span className="text-foreground font-medium">{c.project_name}</span>
            </p>
          )}
        </div>

        {resolvedContacts.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <Users className="w-3 h-3" /> Personas detectadas
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {resolvedContacts.map((p: any, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${p.id ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5" : "border-amber-500/30 text-amber-600 bg-amber-500/5"}`}
                >
                  {p.resolved || p.name}
                  {p.id ? " ✓" : " ?"}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={handleReject} disabled={busy}>
          <X className="w-3 h-3 mr-1" /> Descartar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleConfirm} disabled={busy || !projectId}>
          {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          Confirmar
        </Button>
      </div>
    </div>
  );
}

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

  const handleAccept = async (suggestion: Suggestion, eventDate?: string, overrideProjectId?: string) => {
    const onCreateEvent = async (data: { title: string; date: string }) => {
      const time = data.date.includes("T") ? data.date.split("T")[1].substring(0, 5) : "09:00";
      await createEvent({ title: data.title, date: data.date.split("T")[0], time, duration: 60 });
    };
    await accept(suggestion, eventDate, onCreateEvent, overrideProjectId);
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

  // Sort: classifications first (most contextual), then the rest
  const sorted = [...suggestions].sort((a, b) => {
    const aw = a.suggestion_type === "classification_from_plaud" ? 0 : 1;
    const bw = b.suggestion_type === "classification_from_plaud" ? 0 : 1;
    return aw - bw;
  });

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
        {sorted.map((s) =>
          s.suggestion_type === "classification_from_plaud" ? (
            <ClassificationItem key={s.id} suggestion={s} onAccept={handleAccept} onReject={reject} />
          ) : (
            <SuggestionItem key={s.id} suggestion={s} onAccept={handleAccept} onReject={reject} />
          )
        )}
      </CardContent>
    </Card>
  );
};
