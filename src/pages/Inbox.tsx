import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Inbox as InboxIcon, Brain, Briefcase, Baby, User, CheckCircle2, AlertCircle, ArrowRight, Clock, Lightbulb, Check, X, Search, MessageSquare, RotateCcw, Heart, Trash2, UserX, Link, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AcceptEventDialog } from "@/components/suggestions/AcceptEventDialog";
import { inferTaskType, mapPriority } from "@/lib/suggestionUtils";
import { useCalendar } from "@/hooks/useCalendar";

const BRAIN_CONFIG = {
  professional: { label: "Profesional", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  personal: { label: "Personal", icon: User, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  bosco: { label: "Bosco", icon: Baby, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

const SUGGESTION_ICONS: Record<string, any> = {
  task: CheckCircle2,
  event: Clock,
  person: User,
  idea: Lightbulb,
  follow_up: ArrowRight,
};

interface ExtractedResult {
  brain: "professional" | "personal" | "bosco";
  title: string;
  summary: string;
  tasks: Array<{ title: string; priority: string; brain: string }>;
  commitments: Array<{ description: string; type: string; person_name?: string; deadline?: string }>;
  people: Array<{ name: string; relationship?: string; context?: string }>;
  follow_ups: Array<{ topic: string; resolve_by?: string }>;
  events: Array<{ title: string; date?: string }>;
}

export default function Inbox() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ExtractedResult | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ id: string; title: string; content: any } | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const calendar = useCalendar();

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBrain, setSearchBrain] = useState<string>("all");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ answer: string | null; matches: any[] } | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessingDay, setReprocessingDay] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [showAmbient, setShowAmbient] = useState(false);
  const [linkingSpeaker, setLinkingSpeaker] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // Unidentified speakers query
  const { data: unidentifiedSpeakers = [] } = useQuery({
    queryKey: ["unidentified-speakers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_embeddings")
        .select("people")
        .order("date", { ascending: false })
        .limit(500);
      const speakerSet = new Set<string>();
      for (const row of data || []) {
        for (const p of row.people || []) {
          if (/^Speaker\s+\d+$/i.test(p) || /^Hablante\s+\d+$/i.test(p)) {
            speakerSet.add(p);
          }
        }
      }
      return Array.from(speakerSet).sort();
    },
    enabled: !!user,
  });

  // Contacts for linking
  const { data: allContacts = [] } = useQuery({
    queryKey: ["people-contacts-for-link", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("people_contacts")
        .select("id, name")
        .order("name");
      return data || [];
    },
    enabled: !!user && unidentifiedSpeakers.length > 0,
  });

  const handleLinkSpeaker = async (speakerName: string, contactName: string) => {
    try {
      // Replace speaker name in all embeddings
      const { data: rows } = await supabase
        .from("conversation_embeddings")
        .select("id, people")
        .contains("people", [speakerName]);
      for (const row of rows || []) {
        const updated = (row.people || []).map((p: string) => p === speakerName ? contactName : p);
        await supabase.from("conversation_embeddings").update({ people: updated }).eq("id", row.id);
      }
      toast.success(`"${speakerName}" vinculado a "${contactName}"`);
      setLinkingSpeaker(null);
      queryClient.invalidateQueries({ queryKey: ["unidentified-speakers"] });
      queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
    } catch {
      toast.error("Error al vincular");
    }
  };

  const handleCreateFromSpeaker = async (speakerName: string) => {
    if (!user) return;
    const newName = prompt(`Nombre para "${speakerName}":`, speakerName);
    if (!newName?.trim()) return;
    try {
      await supabase.from("people_contacts").insert({ user_id: user.id, name: newName.trim(), brain: "personal" });
      await handleLinkSpeaker(speakerName, newName.trim());
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    } catch {
      toast.error("Error al crear contacto");
    }
  };

  const handleAssignBrain = async (transcriptionId: string, newBrain: string) => {
    setAssigningId(transcriptionId);
    try {
      await supabase.from("transcriptions").update({ brain: newBrain }).eq("id", transcriptionId);
      await supabase.from("conversation_embeddings").update({ brain: newBrain }).eq("transcription_id", transcriptionId);
      queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
      queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
      toast.success(`Asignada a ${newBrain === "professional" ? "Profesional" : newBrain === "personal" ? "Personal" : "Familiar"}`);
    } catch (e: any) {
      toast.error("Error al asignar");
    } finally {
      setAssigningId(null);
    }
  };

  const handleDiscardTranscription = async (transcriptionId: string) => {
    if (!confirm("¿Eliminar esta transcripción y todos sus datos asociados?")) return;
    try {
      await supabase.from("conversation_embeddings").delete().eq("transcription_id", transcriptionId);
      await supabase.from("suggestions").delete().eq("source_transcription_id", transcriptionId);
      await supabase.from("transcriptions").delete().eq("id", transcriptionId);
      queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
      queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
      toast.success("Transcripción eliminada");
    } catch (e: any) {
      toast.error("Error al eliminar");
    }
  };

  const { data: pendingSuggestions = [] } = useQuery({
    queryKey: ["pending-suggestions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allTranscriptions } = useQuery({
    queryKey: ["all-transcriptions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transcriptions")
        .select("id, title, brain, summary, source, created_at, is_ambient")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const filteredTranscriptions = allTranscriptions?.filter((t: any) => showAmbient || !t.is_ambient) || [];
  const ambientCount = allTranscriptions?.filter((t: any) => t.is_ambient).length || 0;

  const groupedTranscriptions = (() => {
    if (!filteredTranscriptions.length) return {};
    const groups: Record<string, Record<string, Record<string, typeof filteredTranscriptions>>> = {};
    for (const t of filteredTranscriptions) {
      const d = new Date(t.created_at);
      const year = String(d.getFullYear());
      const month = d.toLocaleDateString("es-ES", { month: "long" });
      const day = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = {};
      if (!groups[year][month][day]) groups[year][month][day] = [];
      groups[year][month][day].push(t);
    }
    return groups;
  })();

  const createCalendarEvent = async (title: string, date: string, time: string, description?: string) => {
    if (!session?.access_token) return;
    try {
      const startHour = parseInt(time.split(":")[0]) || 10;
      const startMin = parseInt(time.split(":")[1]) || 0;
      const startDate = new Date(`${date}T${String(startHour).padStart(2,"0")}:${String(startMin).padStart(2,"0")}:00`);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      await supabase.functions.invoke("google-calendar", {
        body: {
          action: "create",
          title,
          date,
          time: `${String(startHour).padStart(2,"0")}:${String(startMin).padStart(2,"0")}`,
          duration: 60,
          description,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success("Evento creado en el calendario");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (e: any) {
      console.error("Calendar create error:", e);
      toast.error("Error al crear el evento en el calendario");
    }
  };

  const handleAcceptSuggestion = (id: string, suggestion_type: string, content: any) => {
    if (suggestion_type === "event") {
      const eventDate = content?.data?.date;
      const title = content?.label || content?.title || content?.data?.title || "Evento";
      if (eventDate) {
        // Has date, create directly
        setCreatingEvent(true);
        createCalendarEvent(title, eventDate, content?.data?.time || "10:00", content?.data?.context).then(() => {
          supabase.from("suggestions").update({ status: "accepted" }).eq("id", id).then(() => {
            queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
            setCreatingEvent(false);
          });
        });
      } else {
        // No date, open dialog
        setPendingEvent({ id, title, content });
      }
      return;
    }
    updateSuggestion.mutate({ id, status: "accepted", suggestion_type, content });
  };

  const handleEventDialogConfirm = async (date: string, time: string) => {
    if (!pendingEvent) return;
    setCreatingEvent(true);
    await createCalendarEvent(pendingEvent.title, date, time, pendingEvent.content?.data?.context);
    await supabase.from("suggestions").update({ status: "accepted" }).eq("id", pendingEvent.id);
    queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
    setPendingEvent(null);
    setCreatingEvent(false);
  };

  const updateSuggestion = useMutation({
    mutationFn: async ({ id, status, suggestion_type, content }: { id: string; status: string; suggestion_type?: string; content?: any }) => {
      const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
      if (error) throw error;

      if (status === "accepted" && suggestion_type === "task" && user) {
        const title = content?.label || content?.title || content?.data?.title || "Tarea desde transcripción";
        const description = content?.data?.context || content?.description || null;
        const taskType = inferTaskType(content);
        const priority = mapPriority(content);
        const { error: taskError } = await supabase.from("tasks").insert({
          user_id: user.id,
          title,
          type: taskType,
          priority,
          duration: 30,
          completed: false,
          source: "plaud",
          description,
        });
        if (taskError) throw taskError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
      if (vars.suggestion_type === "task" && vars.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
      toast.success(vars.status === "accepted" ? "Sugerencia aceptada" : "Sugerencia rechazada");
    },
    onError: (err: any) => {
      console.error("Error actualizando sugerencia:", err);
      toast.error("Error al procesar sugerencia", { description: err.message });
    },
  });

  const handleProcess = async () => {
    if (!text.trim() || text.trim().length < 10) {
      toast.error("El texto es demasiado corto para procesar");
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("process-transcription", {
        body: { text, source: "manual" },
      });

      if (error) throw error;
      setResult(data.extracted);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
      toast.success("Transcripción procesada correctamente");
    } catch (e: any) {
      console.error("Process error:", e);
      toast.error(e.message || "Error procesando transcripción");
    } finally {
      setProcessing(false);
    }
  };

  const brainInfo = result ? BRAIN_CONFIG[result.brain] : null;

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      toast.error("La búsqueda necesita al menos 3 caracteres");
      return;
    }
    setSearching(true);
    setSearchResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("search-rag", {
        body: { query: searchQuery, brain: searchBrain === "all" ? null : searchBrain, limit: 8 },
      });
      if (error) throw error;
      setSearchResults(data);
    } catch (e: any) {
      console.error("Search error:", e);
      toast.error("Error en la búsqueda");
    } finally {
      setSearching(false);
    }
  };

  const handleReprocess = async (transcriptionId: string) => {
    setReprocessingId(transcriptionId);
    try {
      const { data, error } = await supabase.functions.invoke("process-transcription", {
        body: { reprocess_transcription_id: transcriptionId },
      });
      if (error) throw error;
      toast.success("Transcripción reprocesada correctamente");
      queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
      queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
    } catch (e: any) {
      console.error("Reprocess error:", e);
      toast.error(e.message || "Error reprocesando");
    } finally {
      setReprocessingId(null);
    }
  };

  const handleReprocessDay = async (dayLabel: string, items: any[]) => {
    const nonAmbient = items.filter((t: any) => !t.is_ambient);
    if (nonAmbient.length === 0) {
      toast.info("No hay transcripciones para reprocesar en este día");
      return;
    }
    if (!confirm(`¿Reprocesar ${nonAmbient.length} transcripción(es) del ${dayLabel}?`)) return;
    setReprocessingDay(dayLabel);
    let ok = 0;
    let fail = 0;
    for (const t of nonAmbient) {
      try {
        const { error } = await supabase.functions.invoke("process-transcription", {
          body: { reprocess_transcription_id: t.id },
        });
        if (error) throw error;
        ok++;
      } catch {
        fail++;
      }
    }
    setReprocessingDay(null);
    queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
    queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
    if (fail === 0) {
      toast.success(`${ok} transcripción(es) reprocesada(s) correctamente`);
    } else {
      toast.warning(`${ok} reprocesadas, ${fail} con error`);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <InboxIcon className="w-6 h-6 text-primary" />
          Inbox Inteligente
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pega transcripciones de Plaud Note Pro, reuniones o notas. JARVIS las clasifica y extrae tareas, compromisos y contactos automáticamente.
        </p>
      </div>

      {/* Semantic Search */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Buscar en memoria
          </CardTitle>
          <CardDescription>Busca en tus conversaciones y transcripciones pasadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="¿Qué dije sobre...?"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Select value={searchBrain} onValueChange={setSearchBrain}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="professional">Profesional</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="bosco">Bosco</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={searching || searchQuery.trim().length < 3}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchResults && (
            <div className="space-y-3 animate-in fade-in-0">
              {searchResults.answer && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{searchResults.answer}</p>
                  </div>
                </div>
              )}
              {searchResults.matches?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{searchResults.matches.length} fragmento(s) encontrado(s)</p>
                  {searchResults.matches.map((m: any, i: number) => {
                    const brain = BRAIN_CONFIG[m.brain as keyof typeof BRAIN_CONFIG];
                    return (
                      <div key={i} className="p-2 rounded-lg bg-muted/50 border border-border text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          {brain && <brain.icon className={`w-3 h-3 ${brain.color}`} />}
                          <span className="text-xs text-muted-foreground">{m.date}</span>
                          {m.people?.length > 0 && <Badge variant="outline" className="text-xs">{m.people.join(", ")}</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">{Math.round(m.similarity * 100)}%</span>
                        </div>
                        <p className="text-xs">{m.summary}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {searchResults.matches?.length === 0 && !searchResults.answer && (
                <p className="text-sm text-muted-foreground text-center py-2">No se encontraron resultados.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Sugerencias pendientes ({pendingSuggestions.length})
            </CardTitle>
            <CardDescription>Acciones sugeridas por la IA — aprueba o rechaza cada una</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSuggestions.map((s: any) => {
              const Icon = SUGGESTION_ICONS[s.suggestion_type] || ArrowRight;
              const content = s.content as any;
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{content?.label || "Sugerencia"}</p>
                    <Badge variant="outline" className="text-xs mt-0.5">{s.suggestion_type}</Badge>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => handleAcceptSuggestion(s.id, s.suggestion_type, s.content)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => updateSuggestion.mutate({ id: s.id, status: "rejected" })}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Input */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva transcripción</CardTitle>
          <CardDescription>Pega el texto de tu reunión, conversación o nota</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hoy en la reunión con Pablo hemos decidido que el nuevo proyecto arranca el lunes. Él se encarga de preparar los wireframes para el viernes..."
            className="min-h-[150px] bg-background"
            disabled={processing}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length > 0 ? `${text.length} caracteres` : "Mínimo 10 caracteres"}
            </span>
            <Button onClick={handleProcess} disabled={processing || text.trim().length < 10}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Procesar con IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && brainInfo && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4">
          <Card className={`border ${brainInfo.bg}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <brainInfo.icon className={`w-5 h-5 ${brainInfo.color}`} />
                <CardTitle className="text-base">{result.title}</CardTitle>
                <Badge variant="outline" className={brainInfo.color}>{brainInfo.label}</Badge>
              </div>
              <CardDescription>{result.summary}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.tasks?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Tareas detectadas ({result.tasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="w-3 h-3 mt-1 text-muted-foreground shrink-0" />
                      <span className="flex-1">{task.title}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{task.priority}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.commitments?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    Compromisos ({result.commitments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.commitments.map((c, i) => (
                    <div key={i} className="text-sm space-y-0.5">
                      <p>{c.description}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {c.person_name && <span>👤 {c.person_name}</span>}
                        {c.deadline && <span>📅 {c.deadline}</span>}
                        <Badge variant="secondary" className="text-xs">
                          {c.type === "third_party" ? "De tercero" : "Propio"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.people?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    Personas ({result.people.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.people.map((p, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{p.name}</span>
                      {p.relationship && <span className="text-muted-foreground"> · {p.relationship}</span>}
                      {p.context && <p className="text-xs text-muted-foreground mt-0.5">{p.context}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.follow_ups?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-400" />
                    Seguimientos ({result.follow_ups.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.follow_ups.map((f, i) => (
                    <div key={i} className="text-sm">
                      <span>{f.topic}</span>
                      {f.resolve_by && (
                        <span className="text-xs text-muted-foreground ml-2">antes de {f.resolve_by}</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Unidentified Speakers */}
      {unidentifiedSpeakers.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="w-5 h-5 text-amber-400" />
              Speakers sin identificar ({unidentifiedSpeakers.length})
            </CardTitle>
            <CardDescription>Personas detectadas en transcripciones que no están vinculadas a un contacto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unidentifiedSpeakers.map((speaker) => (
              <div key={speaker} className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-sm font-medium flex-1">{speaker}</span>
                {linkingSpeaker === speaker ? (
                  <div className="flex gap-1.5 items-center">
                    <Select value="" onValueChange={(v) => handleLinkSpeaker(speaker, v)}>
                      <SelectTrigger className="h-7 text-xs w-[160px]">
                        <SelectValue placeholder="Seleccionar contacto" />
                      </SelectTrigger>
                      <SelectContent>
                        {allContacts.map((c: any) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLinkingSpeaker(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLinkingSpeaker(speaker)}>
                      <Link className="w-3 h-3" /> Vincular
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCreateFromSpeaker(speaker)}>
                      <UserPlus className="w-3 h-3" /> Crear contacto
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transcription History by Year > Month > Day */}
      {Object.keys(groupedTranscriptions).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Histórico de transcripciones
                </CardTitle>
                <CardDescription>{filteredTranscriptions.length} transcripciones{ambientCount > 0 && ` (${ambientCount} ambientales)`}</CardDescription>
              </div>
              {ambientCount > 0 && (
                <Button size="sm" variant={showAmbient ? "secondary" : "outline"} onClick={() => setShowAmbient(!showAmbient)} className="text-xs gap-1.5">
                  🔇 {showAmbient ? "Ocultar" : "Mostrar"} ambientales
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedTranscriptions).map(([year, months]) => (
              <div key={year}>
                <h3 className="text-sm font-bold text-foreground mb-2 sticky top-0 bg-card py-1">{year}</h3>
                {Object.entries(months).map(([month, days]) => (
                  <div key={month} className="ml-2 mb-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 capitalize">{month}</h4>
                    {Object.entries(days).map(([day, items]) => (
                      <div key={day} className="ml-2 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setCollapsedDays(prev => {
                              const next = new Set(prev);
                              next.has(day) ? next.delete(day) : next.add(day);
                              return next;
                            })}
                          >
                            {collapsedDays.has(day)
                              ? <ChevronDown className="w-3 h-3" />
                              : <ChevronUp className="w-3 h-3" />
                            }
                            {day}
                            <Badge variant="outline" className="text-[10px] ml-1">{(items as any[]).length}</Badge>
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                            disabled={reprocessingDay === day}
                            onClick={() => handleReprocessDay(day, items as any[])}
                          >
                            <RotateCcw className={`w-3 h-3 ${reprocessingDay === day ? "animate-spin" : ""}`} />
                            {reprocessingDay === day ? "Reprocesando..." : "Reprocesar día"}
                          </Button>
                        </div>
                        {!collapsedDays.has(day) && (
                        <div className="space-y-1.5 ml-2 border-l-2 border-border pl-3">
                          {items.map((t: any) => {
                            const brain = BRAIN_CONFIG[t.brain as keyof typeof BRAIN_CONFIG];
                            const isAssigning = assigningId === t.id;
                            const isAmbient = t.is_ambient === true;
                            return (
                              <div key={t.id} className={`py-3 px-3 hover:bg-muted/50 rounded-lg transition-colors ${isAmbient ? "opacity-50" : ""}`}>
                                <div className="flex items-center gap-2.5">
                                  {isAmbient ? <span className="text-sm">🔇</span> : brain && <brain.icon className={`w-3.5 h-3.5 ${brain.color} shrink-0`} />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium truncate">{t.title || "Sin título"}</p>
                                      {isAmbient && <Badge variant="outline" className="text-[10px] text-muted-foreground">Ambiental/TV/Radio</Badge>}
                                    </div>
                                  </div>
                                  <TooltipProvider delayDuration={300}>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant={t.brain === "professional" ? "secondary" : "ghost"}
                                            className={`h-7 w-7 p-0 ${t.brain === "professional" ? "text-blue-500 bg-blue-500/15" : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"}`}
                                            disabled={isAssigning}
                                            onClick={() => handleAssignBrain(t.id, "professional")}>
                                            <Briefcase className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Profesional</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant={t.brain === "personal" ? "secondary" : "ghost"}
                                            className={`h-7 w-7 p-0 ${t.brain === "personal" ? "text-emerald-500 bg-emerald-500/15" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"}`}
                                            disabled={isAssigning}
                                            onClick={() => handleAssignBrain(t.id, "personal")}>
                                            <User className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Personal</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant={t.brain === "bosco" ? "secondary" : "ghost"}
                                            className={`h-7 w-7 p-0 ${t.brain === "bosco" ? "text-amber-500 bg-amber-500/15" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"}`}
                                            disabled={isAssigning}
                                            onClick={() => handleAssignBrain(t.id, "bosco")}>
                                            <Heart className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Familiar</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant="ghost"
                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDiscardTranscription(t.id)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Eliminar</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground shrink-0"
                                    disabled={reprocessingId === t.id}
                                    onClick={() => handleReprocess(t.id)}
                                  >
                                    <RotateCcw className={`w-3 h-3 ${reprocessingId === t.id ? "animate-spin" : ""}`} />
                                    {reprocessingId === t.id ? "..." : "Reprocesar"}
                                  </Button>
                                  <Badge variant="outline" className="text-[10px] shrink-0">{t.source || "manual"}</Badge>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {new Date(t.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                {t.summary && (
                                  <p className="text-xs text-muted-foreground truncate mt-1.5 ml-6">{t.summary}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AcceptEventDialog
        open={!!pendingEvent}
        onOpenChange={(open) => !open && setPendingEvent(null)}
        title={pendingEvent?.title || ""}
        onConfirm={handleEventDialogConfirm}
        loading={creatingEvent}
      />
    </div>
  );
}
