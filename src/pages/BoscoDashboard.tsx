import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useBosco } from "@/hooks/useBosco";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { 
  Brain, Sparkles, Palette, Baby, Heart, Globe, BookOpen,
  Calendar, MessageSquare, ArrowRight, Star, Lightbulb,
  Clock, Check, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface DiaryEntry {
  id: string;
  title: string;
  summary: string;
  date: string;
  speakers: string[];
  sentiment: string | null;
}

export default function BoscoDashboard() {
  const { user } = useAuth();
  const { activities, vocabulary, vocabularyStats, loading, generateActivities, generatingActivities } = useBosco();
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(true);
  const [dailySuggestion, setDailySuggestion] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const completedToday = activities.filter(a => a.completed).length;
  const totalToday = activities.length;

  // Fetch diary entries from PLAUD transcriptions (brain = 'bosco')
  useEffect(() => {
    if (!user) return;
    const fetchDiary = async () => {
      const { data, error } = await supabase
        .from("conversation_embeddings")
        .select("id, summary, content, date, people, metadata")
        .eq("user_id", user.id)
        .eq("brain", "bosco")
        .order("date", { ascending: false })
        .limit(20);

      if (!error && data) {
        setDiary(data.map((d: any) => ({
          id: d.id,
          title: d.summary?.split(".")[0] || "Momento con Bosco",
          summary: d.summary || "",
          date: d.date,
          speakers: d.people || [],
          sentiment: (d.metadata as any)?.sentiment || null,
        })));
      }
      setDiaryLoading(false);
    };
    fetchDiary();
  }, [user]);

  // Generate daily suggestion
  useEffect(() => {
    if (!user) return;
    const generateSuggestion = async () => {
      setSuggestionLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("jarvis-bosco", {
          body: {
            messages: [{ role: "user", content: "Dame UNA sugerencia corta (máx 2 frases) de algo bonito para hacer hoy con Bosco (5 años). Basándote en que es un día normal entre semana. Responde SOLO la sugerencia, sin preámbulos." }],
            context: { childAge: 5, childName: "Bosco" },
            queryType: "advice"
          }
        });
        if (!error && data?.message) {
          setDailySuggestion(data.message);
        }
      } catch {
        setDailySuggestion("Leer un cuento juntos antes de dormir 📚");
      }
      setSuggestionLoading(false);
    };
    generateSuggestion();
  }, [user]);

  const sentimentEmoji = (s: string | null) => {
    if (!s) return "💬";
    if (s === "positive") return "😊";
    if (s === "negative") return "😟";
    if (s === "mixed") return "🤔";
    return "💬";
  };

  if (loading) {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-4xl shadow-lg">
          👦
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bosco — 5 años</h1>
          <p className="text-muted-foreground text-sm">Panel de seguimiento y actividades</p>
        </div>
      </div>

      {/* Daily Suggestion */}
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Hoy es buen día para...</p>
              {suggestionLoading ? (
                <Skeleton className="h-5 w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">{dailySuggestion}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{completedToday}/{totalToday}</p>
            <p className="text-xs text-muted-foreground">Actividades hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vocabularyStats.totalWords}</p>
            <p className="text-xs text-muted-foreground">Palabras EN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vocabularyStats.streak}</p>
            <p className="text-xs text-muted-foreground">Días racha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{diary.length}</p>
            <p className="text-xs text-muted-foreground">Entradas diario</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/bosco/activities">
          <Card className="hover:border-amber-500/50 transition-colors cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Actividades diarias</h3>
                  <p className="text-xs text-muted-foreground">Juegos, lectura, vocabulario</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              </div>
              {totalToday > 0 && (
                <div className="flex gap-1">
                  {activities.slice(0, 4).map(a => (
                    <Badge key={a.id} variant={a.completed ? "default" : "secondary"} className="text-[10px]">
                      {a.completed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link to="/bosco/ai">
          <Card className="hover:border-purple-500/50 transition-colors cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Iniciación a la IA</h3>
                  <p className="text-xs text-muted-foreground">Montessori + pensamiento computacional</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
              </div>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-[10px]">🔍 Explorar</Badge>
                <Badge variant="outline" className="text-[10px]">🎨 Crear</Badge>
                <Badge variant="outline" className="text-[10px]">🧩 Lógica</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/bosco/development">
          <Card className="hover:border-green-500/50 transition-colors cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Desarrollo integral</h3>
                  <p className="text-xs text-muted-foreground">5 áreas de crecimiento</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
              </div>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">🧠</Badge>
                <Badge variant="outline" className="text-[10px]">🎨</Badge>
                <Badge variant="outline" className="text-[10px]">🤸</Badge>
                <Badge variant="outline" className="text-[10px]">💬</Badge>
                <Badge variant="outline" className="text-[10px]">🌍</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Diary from PLAUD */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Diario de Bosco
            <Badge variant="secondary" className="ml-auto text-xs">{diary.length} momentos</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Momentos extraídos automáticamente de tus conversaciones PLAUD</p>
        </CardHeader>
        <CardContent>
          {diaryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
            </div>
          ) : diary.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Aún no hay entradas en el diario</p>
              <p className="text-xs text-muted-foreground mt-1">Las conversaciones familiares de PLAUD se registran aquí automáticamente</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {diary.map((entry) => (
                  <div key={entry.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="text-2xl shrink-0">{sentimentEmoji(entry.sentiment)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-foreground truncate">{entry.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {format(parseISO(entry.date), "d MMM", { locale: es })}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.summary}</p>
                      {entry.speakers.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {entry.speakers.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
