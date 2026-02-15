import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Briefcase, User, Heart, MessageSquare, Lightbulb,
  Handshake, RotateCcw, Users, Check, X, Clock,
  AlertCircle, CalendarDays, ListTodo, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";
import { AcceptEventDialog } from "@/components/suggestions/AcceptEventDialog";
import { inferTaskType, mapPriority } from "@/lib/suggestionUtils";
import { useCalendar } from "@/hooks/useCalendar";
import { ConversationCard } from "@/components/brain/ConversationCard";

const BRAIN_CONFIG: Record<string, { label: string; icon: any; dbBrain: string }> = {
  professional: { label: "Profesional", icon: Briefcase, dbBrain: "professional" },
  personal: { label: "Personal", icon: User, dbBrain: "personal" },
  family: { label: "Familiar", icon: Heart, dbBrain: "bosco" },
};

const BrainDashboard = () => {
  const { brainType } = useParams<{ brainType: string }>();
  const config = brainType ? BRAIN_CONFIG[brainType] : null;

  if (!config) return <Navigate to="/dashboard" replace />;

  return <BrainDashboardContent config={config} />;
};

const BrainDashboardContent = ({ config }: { config: { label: string; icon: any; dbBrain: string } }) => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const dbBrain = config.dbBrain;
  const [pendingEvent, setPendingEvent] = useState<{ id: string; title: string; content: any } | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const calendar = useCalendar();

  // Conversations - fetch all chunks and group by transcription_id
  const { data: conversationGroups = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["brain-conversations", dbBrain, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_embeddings")
        .select("id, date, brain, summary, people, transcription_id, metadata")
        .eq("brain", dbBrain)
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(200);

      // Group by transcription_id
      const groups = new Map<string, typeof data>();
      for (const row of data || []) {
        const key = row.transcription_id || row.id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      // Convert to ConversationGroup array, limited to 20
      return Array.from(groups.values())
        .map(segments => ({ main: segments[0], segments }))
        .slice(0, 20);
    },
    enabled: !!user,
  });

  // Flatten for transcription IDs
  const conversations = conversationGroups.map(g => g.main);

  // Get transcription IDs for this brain to filter related tables
  const transcriptionIds = conversations
    .map(c => c.transcription_id)
    .filter(Boolean) as string[];

  // Suggestions
  const { data: suggestions = [], isLoading: loadingSugg } = useQuery({
    queryKey: ["brain-suggestions", dbBrain, transcriptionIds],
    queryFn: async () => {
      if (transcriptionIds.length === 0) return [];
      const { data } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", user!.id)
        .in("source_transcription_id", transcriptionIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user && transcriptionIds.length > 0,
  });

  // Commitments
  const { data: commitments = [], isLoading: loadingComm } = useQuery({
    queryKey: ["brain-commitments", dbBrain, transcriptionIds],
    queryFn: async () => {
      if (transcriptionIds.length === 0) return [];
      const { data } = await supabase
        .from("commitments")
        .select("*")
        .eq("user_id", user!.id)
        .in("source_transcription_id", transcriptionIds)
        .neq("status", "completed")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user && transcriptionIds.length > 0,
  });

  // Follow-ups
  const { data: followUps = [], isLoading: loadingFU } = useQuery({
    queryKey: ["brain-followups", dbBrain, transcriptionIds],
    queryFn: async () => {
      if (transcriptionIds.length === 0) return [];
      const { data } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("user_id", user!.id)
        .in("source_transcription_id", transcriptionIds)
        .neq("status", "resolved")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user && transcriptionIds.length > 0,
  });

  // Contacts
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["brain-contacts", dbBrain, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("people_contacts")
        .select("id, name, company, role, relationship, email, sentiment, ai_tags")
        .eq("brain", dbBrain)
        .eq("user_id", user!.id)
        .order("last_contact", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
  });

  const createCalendarEvent = async (title: string, date: string, time: string, description?: string) => {
    if (!session?.access_token) return;
    try {
      await supabase.functions.invoke("google-calendar", {
        body: { action: "create", title, date, time, duration: 60, description },
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
        setCreatingEvent(true);
        createCalendarEvent(title, eventDate, content?.data?.time || "10:00", content?.data?.context).then(() => {
          supabase.from("suggestions").update({ status: "accepted" }).eq("id", id).then(() => {
            queryClient.invalidateQueries({ queryKey: ["brain-suggestions"] });
            setCreatingEvent(false);
          });
        });
      } else {
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
    queryClient.invalidateQueries({ queryKey: ["brain-suggestions"] });
    setPendingEvent(null);
    setCreatingEvent(false);
  };

  // Mutations for suggestions
  const updateSuggestion = useMutation({
    mutationFn: async ({ id, status, suggestion_type, content }: { id: string; status: string; suggestion_type?: string; content?: any }) => {
      const { error } = await supabase
        .from("suggestions")
        .update({ status })
        .eq("id", id);
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
      queryClient.invalidateQueries({ queryKey: ["brain-suggestions"] });
      if (vars.suggestion_type === "task" && vars.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
      toast.success("Sugerencia actualizada");
    },
    onError: (err: any) => {
      console.error("Error actualizando sugerencia:", err);
      toast.error("Error al procesar sugerencia", { description: err.message });
    },
  });

  const updateCommitment = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("commitments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-commitments"] });
      toast.success("Compromiso actualizado");
    },
  });

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-followups"] });
      toast.success("Follow-up actualizado");
    },
  });

  const BrainIcon = config.icon;
  const isLoading = loadingConvs || loadingSugg || loadingComm || loadingFU || loadingContacts;
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const formatDate = (d: string) => {
    try { return format(new Date(d), "d MMM yyyy", { locale: es }); }
    catch { return d; }
  };

  const getSuggestionLabel = (type: string) => {
    const map: Record<string, string> = {
      task: "Tarea", follow_up: "Follow-up", event: "Evento", idea: "Idea", reminder: "Recordatorio"
    };
    return map[type] || type;
  };

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <BrainIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard {config.label}</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de conversaciones, tareas y seguimientos
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Conversaciones", value: conversationGroups.length, icon: MessageSquare },
          { label: "Sugerencias", value: suggestions.length, icon: Lightbulb },
          { label: "Compromisos", value: commitments.length, icon: Handshake },
          { label: "Contactos", value: contacts.length, icon: Users },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{isLoading ? "–" : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversations */}
        <CollapsibleCard id="brain-convs" title="Conversaciones recientes" icon={<MessageSquare className="w-4 h-4 text-primary" />}>
          {loadingConvs ? (
            <div className="space-y-3 p-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : conversationGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No hay conversaciones registradas</p>
          ) : (
             <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
              {conversationGroups.map(group => (
                <ConversationCard key={group.main.id} group={group} dbBrain={dbBrain} />
              ))}
            </div>
          )}
        </CollapsibleCard>

        {/* Suggestions */}
        <CollapsibleCard
          id="brain-sugg"
          title="Sugerencias pendientes"
          icon={<Lightbulb className="w-4 h-4 text-primary" />}
          badge={suggestions.length > 0 ? <Badge variant="secondary" className="text-[10px] ml-1">{suggestions.length}</Badge> : undefined}
        >
          {loadingSugg ? (
            <div className="space-y-3 p-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin sugerencias pendientes</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
              {suggestions.map(s => {
                const content = s.content as Record<string, any> | null;
                const title = content?.label || content?.title || content?.description || "Sugerencia";
                const description = content?.data?.description || content?.data?.context || null;
                const priority = content?.data?.priority || null;
                const category = content?.data?.category || null;
                const isExpanded = expandedSuggestion === s.id;
                return (
                  <div key={s.id} className="p-3">
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => setExpandedSuggestion(isExpanded ? null : s.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px]">{getSuggestionLabel(s.suggestion_type)}</Badge>
                          {priority && <Badge variant="secondary" className="text-[10px]">{priority}</Badge>}
                          <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground">{title}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 pl-1 space-y-2">
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                        {category && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{category}</Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-green-600 border-green-600/30 hover:bg-green-500/10"
                            onClick={(e) => { e.stopPropagation(); handleAcceptSuggestion(s.id, s.suggestion_type, content); }}
                          >
                            <Check className="w-3 h-3" /> Aceptar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); updateSuggestion.mutate({ id: s.id, status: "dismissed" }); }}
                          >
                            <X className="w-3 h-3" /> Rechazar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleCard>

        {/* Commitments */}
        <CollapsibleCard
          id="brain-comm"
          title="Compromisos activos"
          icon={<Handshake className="w-4 h-4 text-primary" />}
          badge={commitments.length > 0 ? <Badge variant="secondary" className="text-[10px] ml-1">{commitments.length}</Badge> : undefined}
        >
          {loadingComm ? (
            <div className="space-y-3 p-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : commitments.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin compromisos pendientes</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[350px] overflow-y-auto">
              {commitments.map(c => (
                <div key={c.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.person_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />{c.person_name}
                        </span>
                      )}
                      {c.deadline && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDate(c.deadline)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">{c.commitment_type}</Badge>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500 hover:bg-green-500/10 shrink-0"
                    onClick={() => updateCommitment.mutate({ id: c.id, status: "completed" })}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>

        {/* Follow-ups */}
        <CollapsibleCard
          id="brain-fu"
          title="Follow-ups abiertos"
          icon={<RotateCcw className="w-4 h-4 text-primary" />}
          badge={followUps.length > 0 ? <Badge variant="secondary" className="text-[10px] ml-1">{followUps.length}</Badge> : undefined}
        >
          {loadingFU ? (
            <div className="space-y-3 p-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin follow-ups pendientes</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[350px] overflow-y-auto">
              {followUps.map(fu => (
                <div key={fu.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{fu.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {fu.resolve_by && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />{formatDate(fu.resolve_by)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">{fu.status}</Badge>
                    </div>
                    {fu.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{fu.notes}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500 hover:bg-green-500/10 shrink-0"
                    onClick={() => updateFollowUp.mutate({ id: fu.id, status: "resolved" })}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>
      </div>

      {/* Contacts */}
      <CollapsibleCard id="brain-contacts" title={`Contactos ${config.label}`} icon={<Users className="w-4 h-4 text-primary" />}>
        {loadingContacts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No hay contactos en este ámbito</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{c.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.role, c.company].filter(Boolean).join(" · ") || c.relationship || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>
      <AcceptEventDialog
        open={!!pendingEvent}
        onOpenChange={(open) => !open && setPendingEvent(null)}
        title={pendingEvent?.title || ""}
        onConfirm={handleEventDialogConfirm}
        loading={creatingEvent}
      />
    </main>
  );
};

export default BrainDashboard;
