import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Brain, RefreshCw, Baby, Sparkles, BookOpen, Palette, Dumbbell,
  Heart, MessageSquare, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Star, Lightbulb, Target, Send, ArrowUp, ArrowDown, ChevronRight,
  Smile, Frown, Shield, Loader2, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface GardnerScores {
  linguistic: number;
  logical_mathematical: number;
  spatial: number;
  musical: number;
  bodily_kinesthetic: number;
  interpersonal: number;
  intrapersonal: number;
  naturalist: number;
}

interface DevArea {
  level: number;
  trend: "improving" | "stable" | "needs_attention";
  last_milestone: string;
}

interface Recommendation {
  title: string;
  description: string;
  theory: string;
  priority: "high" | "medium" | "low";
}

interface FocusArea {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface BoscoProfileData {
  bio_narrative: string;
  gardner_scores: GardnerScores;
  personality_traits: string[];
  development_areas: Record<string, DevArea>;
  emotional_map: { frustrations: string[]; joys: string[]; fears: string[] };
  ai_recommendations: Recommendation[];
  focus_areas: FocusArea[];
  last_analysis_at: string | null;
  observation_count: number;
  updated_at: string;
}

interface Observation {
  id: string;
  area: string;
  observation: string;
  theory_reference: string;
  tags: string[];
  sentiment: string;
  date: string;
}

const AREA_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string; bg: string }> = {
  cognitive: { label: "Cognitivo", icon: Brain, color: "text-blue-500", bg: "bg-blue-500/15" },
  linguistic: { label: "Linguistico", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/15" },
  motor: { label: "Motor", icon: Dumbbell, color: "text-orange-500", bg: "bg-orange-500/15" },
  social_emotional: { label: "Social-Emocional", icon: Heart, color: "text-pink-500", bg: "bg-pink-500/15" },
  creative: { label: "Creativo", icon: Palette, color: "text-violet-500", bg: "bg-violet-500/15" },
};

const GARDNER_LABELS: Record<string, string> = {
  linguistic: "Linguistica",
  logical_mathematical: "Logico-Matematica",
  spatial: "Espacial",
  musical: "Musical",
  bodily_kinesthetic: "Corporal-Cinestesica",
  interpersonal: "Interpersonal",
  intrapersonal: "Intrapersonal",
  naturalist: "Naturalista",
};

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "improving") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === "needs_attention") return <TrendingDown className="w-4 h-4 text-amber-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

export default function BoscoProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BoscoProfileData | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [profileRes, obsRes] = await Promise.all([
      supabase.from("bosco_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("bosco_observations").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(100),
    ]);

    if (profileRes.data) {
      setProfile({
        bio_narrative: profileRes.data.bio_narrative || "",
        gardner_scores: (profileRes.data.gardner_scores || {}) as unknown as GardnerScores,
        personality_traits: (profileRes.data.personality_traits || []) as string[],
        development_areas: (profileRes.data.development_areas || {}) as unknown as Record<string, DevArea>,
        emotional_map: (profileRes.data.emotional_map || { frustrations: [], joys: [], fears: [] }) as any,
        ai_recommendations: (profileRes.data.ai_recommendations || []) as unknown as Recommendation[],
        focus_areas: (profileRes.data.focus_areas || []) as unknown as FocusArea[],
        last_analysis_at: profileRes.data.last_analysis_at,
        observation_count: profileRes.data.observation_count || 0,
        updated_at: profileRes.data.updated_at,
      });
    }
    if (obsRes.data) {
      setObservations(obsRes.data as unknown as Observation[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateBio = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("bosco-intelligence", {
        body: { mode: "generate_bio" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Perfil actualizado con " + (data.observation_count || 0) + " observaciones");
        await fetchData();
      } else {
        toast.error(data?.error || "Error generando perfil");
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
    setGenerating(false);
  };

  const askQuestion = async () => {
    if (!chatQuestion.trim()) return;
    const q = chatQuestion.trim();
    setChatQuestion("");
    const newMessages = [...chatMessages, { role: "user" as const, content: q }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("bosco-intelligence", {
        body: { mode: "chat", messages: newMessages, question: q },
      });
      if (error) throw error;
      if (data?.answer) {
        setChatMessages([...newMessages, { role: "assistant", content: data.answer }]);
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
    setChatLoading(false);
  };

  const filteredObs = selectedArea
    ? observations.filter(o => o.area === selectedArea)
    : observations;

  if (loading) {
    return (
      <main className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
        <Breadcrumbs />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" /><Skeleton className="h-64" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Baby className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Perfil Inteligente de Bosco</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.last_analysis_at
                ? `Ultima actualizacion: ${format(parseISO(profile.last_analysis_at), "d MMM yyyy, HH:mm", { locale: es })}`
                : "Sin analisis previo"}
              {profile && ` -- ${profile.observation_count} observaciones`}
            </p>
          </div>
        </div>
        <Button onClick={generateBio} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {generating ? "Analizando..." : "Actualizar analisis"}
        </Button>
      </div>

      {!profile ? (
        <Card className="border-amber-500/30">
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Sin perfil generado aun</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Las conversaciones familiares de PLAUD generan observaciones automaticamente.
              Cuando haya suficientes, pulsa "Actualizar analisis" para generar el perfil.
            </p>
            <p className="text-xs text-muted-foreground">
              {observations.length > 0
                ? `Ya tienes ${observations.length} observaciones. Puedes generar el perfil ahora.`
                : "Aun no hay observaciones registradas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bio Narrative */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Quien es Bosco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/90 leading-relaxed">{profile.bio_narrative}</p>
              {profile.personality_traits.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {profile.personality_traits.map((trait, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{trait}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gardner Radar (as bar chart since no radar library) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                Inteligencias Multiples (Gardner)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(profile.gardner_scores).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0 text-right">
                      {GARDNER_LABELS[key] || key}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          value >= 7 ? "bg-emerald-500" : value >= 5 ? "bg-blue-500" : "bg-amber-500"
                        )}
                        style={{ width: `${(value / 10) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                        {value}/10
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Development Areas */}
          <div className="grid gap-4 md:grid-cols-5">
            {Object.entries(AREA_CONFIG).map(([key, config]) => {
              const area = profile.development_areas[key];
              if (!area) return null;
              const Icon = config.icon;
              return (
                <Card key={key} className="hover:border-border/80 transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className={cn("w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center", config.bg)}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <p className="text-xs font-medium text-foreground mb-1">{config.label}</p>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="text-2xl font-bold text-foreground">{area.level}</span>
                      <span className="text-xs text-muted-foreground">/10</span>
                      <TrendIcon trend={area.trend} />
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{area.last_milestone || "Sin hito"}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Emotional Map + Recommendations side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Emotional Map */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  Mapa Emocional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "joys", label: "Alegrias", icon: Smile, color: "text-emerald-500", items: profile.emotional_map.joys },
                  { key: "frustrations", label: "Frustraciones", icon: Frown, color: "text-amber-500", items: profile.emotional_map.frustrations },
                  { key: "fears", label: "Miedos", icon: Shield, color: "text-red-400", items: profile.emotional_map.fears },
                ].map(({ key, label, icon: Icon, color, items }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn("w-4 h-4", color)} />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground ml-6">Sin datos aun</p>
                    ) : (
                      <ul className="ml-6 space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Recomendaciones IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.ai_recommendations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin recomendaciones aun</p>
                ) : (
                  <div className="space-y-3">
                    {profile.ai_recommendations.map((rec, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-start gap-2 mb-1">
                          <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"} className="text-[10px] shrink-0">
                            {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                          </Badge>
                          <p className="text-sm font-medium text-foreground">{rec.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{rec.theory}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Focus Areas */}
          {profile.focus_areas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Areas de Foco Actuales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {profile.focus_areas.map((fa, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={fa.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {fa.priority === "high" ? "Prioritario" : fa.priority === "medium" ? "Medio" : "Bajo"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{fa.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fa.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Expert Chat */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            Consulta al Experto
          </CardTitle>
          <p className="text-xs text-muted-foreground">Pregunta cualquier cosa sobre Bosco. Respuestas basadas en sus observaciones reales.</p>
        </CardHeader>
        <CardContent>
          {chatMessages.length > 0 && (
            <ScrollArea className="h-[300px] mb-4">
              <div className="space-y-3 pr-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg text-sm",
                    msg.role === "user"
                      ? "bg-primary/10 ml-8"
                      : "bg-muted/50 border border-border/50 mr-4"
                  )}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {msg.role === "user" ? "Tu" : "Experto"}
                    </p>
                    <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    <span className="text-xs text-muted-foreground">Analizando...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Ej: Es normal que Bosco hable solo mientras juega?"
              value={chatQuestion}
              onChange={e => setChatQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askQuestion()}
              disabled={chatLoading}
            />
            <Button onClick={askQuestion} disabled={chatLoading || !chatQuestion.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Observation Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Registro de Observaciones
            <Badge variant="secondary" className="ml-auto text-xs">{observations.length} total</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge
              variant={selectedArea === null ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedArea(null)}
            >
              Todas
            </Badge>
            {Object.entries(AREA_CONFIG).map(([key, config]) => (
              <Badge
                key={key}
                variant={selectedArea === key ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedArea(key)}
              >
                {config.label}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filteredObs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin observaciones {selectedArea ? "en esta area" : "registradas"}
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredObs.map(obs => {
                  const config = AREA_CONFIG[obs.area] || AREA_CONFIG.cognitive;
                  const Icon = config.icon;
                  return (
                    <div key={obs.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className={cn("w-8 h-8 rounded-lg shrink-0 flex items-center justify-center", config.bg)}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {format(parseISO(obs.date), "d MMM", { locale: es })}
                          </Badge>
                          <Badge
                            variant={obs.sentiment === "positive" ? "default" : obs.sentiment === "concern" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {obs.sentiment === "positive" ? "Positivo" : obs.sentiment === "concern" ? "Atencion" : "Neutral"}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed">{obs.observation}</p>
                        {obs.theory_reference && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{obs.theory_reference}</p>
                        )}
                        {obs.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {obs.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[9px]">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
