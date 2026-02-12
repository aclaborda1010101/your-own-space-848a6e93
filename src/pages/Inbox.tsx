import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Inbox as InboxIcon, Brain, Briefcase, Baby, User, CheckCircle2, AlertCircle, ArrowRight, Clock, Lightbulb, Check, X, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ExtractedResult | null>(null);

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBrain, setSearchBrain] = useState<string>("all");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ answer: string | null; matches: any[] } | null>(null);

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
        .select("id, title, brain, summary, source, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Group transcriptions by year > month > day
  const groupedTranscriptions = (() => {
    if (!allTranscriptions?.length) return {};
    const groups: Record<string, Record<string, Record<string, typeof allTranscriptions>>> = {};
    for (const t of allTranscriptions) {
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

  const updateSuggestion = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-suggestions"] });
      toast.success(vars.status === "accepted" ? "Sugerencia aceptada" : "Sugerencia rechazada");
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
                      onClick={() => updateSuggestion.mutate({ id: s.id, status: "accepted" })}>
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

      {/* Transcription History by Year > Month > Day */}
      {Object.keys(groupedTranscriptions).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Histórico de transcripciones
            </CardTitle>
            <CardDescription>{allTranscriptions?.length || 0} transcripciones en total</CardDescription>
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
                        <p className="text-xs text-muted-foreground mb-1">{day}</p>
                        <div className="space-y-1 ml-2 border-l-2 border-border pl-3">
                          {items.map((t: any) => {
                            const brain = BRAIN_CONFIG[t.brain as keyof typeof BRAIN_CONFIG];
                            return (
                              <div key={t.id} className="flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-2 transition-colors">
                                {brain && <brain.icon className={`w-3.5 h-3.5 ${brain.color} shrink-0`} />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{t.title || "Sin título"}</p>
                                  <p className="text-xs text-muted-foreground truncate">{t.summary}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">{t.source || "manual"}</Badge>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {new Date(t.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
