import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import { useCoachStats } from "@/hooks/useCoachStats";
import { useJarvisCoach } from "@/hooks/useJarvisCoach";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Compass, MessageSquare, CheckSquare, Brain, Loader2, Send,
  Target, Flame, TrendingUp, Lightbulb, RefreshCw, Play,
  Zap, Heart, Calendar, CheckCircle2, AlertCircle,
} from "lucide-react";

const POWERFUL_QUESTIONS = [
  "¿Qué es lo que más te da miedo delegar?",
  "¿Qué harías diferente si supieras que no puedes fallar?",
  "¿Qué necesitas soltar para avanzar?",
  "¿Cuál es tu mayor fortaleza que no estás usando?",
  "¿Qué promesa te has hecho que no estás cumpliendo?",
  "¿Qué patrón repites que ya no te sirve?",
  "¿Dónde estás invirtiendo energía que no te devuelve nada?",
  "Si tuvieras que elegir una sola prioridad esta semana, ¿cuál sería?",
];

const CoachLife = () => {
  const { user } = useAuth();
  const { stats, habits, incrementStreak, addInsight, completeHabit } = useCoachStats();
  const [activeTab, setActiveTab] = useState("checkin");
  const [energy, setEnergy] = useState([5]);
  const [motivation, setMotivation] = useState([5]);
  const [dailyQuestion] = useState(() => POWERFUL_QUESTIONS[Math.floor(Math.random() * POWERFUL_QUESTIONS.length)]);
  const [reflection, setReflection] = useState("");
  const [improvementArea, setImprovementArea] = useState("");

  // Coaching chat
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Insights
  const [insightsContent, setInsightsContent] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  const submitCheckin = async () => {
    if (!reflection.trim()) {
      toast.error("Escribe tu reflexión primero");
      return;
    }
    try {
      await incrementStreak();
      await addInsight();
      toast.success("Check-in guardado. ¡Sigue así!");
      setReflection("");
      setImprovementArea("");
    } catch (e) {
      toast.error("Error guardando check-in");
    }
  };

  const sendCoachMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          sessionType: "socratic",
          message: chatInput,
          emotionalState: { energy: energy[0], motivation: motivation[0] },
          history: chatMessages.slice(-10),
        }),
      });
      if (!response.ok) throw new Error("Error");
      const data = await response.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.response || data.content }]);
    } catch (e) {
      console.error(e);
      toast.error("Error en la sesión");
    } finally {
      setChatLoading(false);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-coach", {
        body: {
          sessionType: "plaud_insights",
          message: "Analiza mis transcripciones PLAUD recientes y detecta patrones de estrés, temas recurrentes y oportunidades de crecimiento.",
        },
      });
      if (error) throw error;
      setInsightsContent(data.response || data.content || "No se encontraron insights.");
      toast.success("Insights generados");
    } catch (e) {
      console.error(e);
      toast.error("Error generando insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🧭 Life Coach
          </h1>
          <p className="text-muted-foreground mt-1">
            Cal Newport · Tim Ferriss · Brené Brown · Hábitos
          </p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm">
          Socrático
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.streak_days || 0}</p>
              <p className="text-xs text-muted-foreground">Racha</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.goal_progress || 0}%</p>
              <p className="text-xs text-muted-foreground">Objetivo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total_sessions || 0}</p>
              <p className="text-xs text-muted-foreground">Sesiones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total_insights || 0}</p>
              <p className="text-xs text-muted-foreground">Insights</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="checkin" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" /> Check-in
          </TabsTrigger>
          <TabsTrigger value="session" className="gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4" /> Sesión
          </TabsTrigger>
          <TabsTrigger value="habits" className="gap-1.5 text-xs sm:text-sm">
            <CheckSquare className="h-4 w-4" /> Hábitos
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs sm:text-sm">
            <Brain className="h-4 w-4" /> Insights
          </TabsTrigger>
        </TabsList>

        {/* Daily Check-in */}
        <TabsContent value="checkin" className="space-y-4">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-emerald-400" />
                Pregunta poderosa del día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium text-center py-2 italic">"{dailyQuestion}"</p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Energía y Motivación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Energía</label>
                    <span className="text-sm text-muted-foreground">{energy[0]}/10</span>
                  </div>
                  <Slider value={energy} onValueChange={setEnergy} max={10} step={1} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Motivación</label>
                    <span className="text-sm text-muted-foreground">{motivation[0]}/10</span>
                  </div>
                  <Slider value={motivation} onValueChange={setMotivation} max={10} step={1} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reflexión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Tu reflexión sobre la pregunta del día..."
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  className="min-h-[80px]"
                />
                <Textarea
                  placeholder="Un área de mejora para hoy..."
                  value={improvementArea}
                  onChange={(e) => setImprovementArea(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button onClick={submitCheckin} className="w-full gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Guardar check-in
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Coaching Session */}
        <TabsContent value="session" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-400" />
                Sesión 1:1 con IA
              </CardTitle>
              <CardDescription>
                Coaching socrático: sin respuestas directas, guiando con preguntas poderosas y escucha activa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[350px] border rounded-xl p-4 bg-muted/30">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
                    <Compass className="h-8 w-8 opacity-50" />
                    <p>Cuéntame qué te preocupa o en qué quieres trabajar hoy</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        )}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-card border rounded-2xl px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Textarea
                  placeholder="¿En qué quieres trabajar hoy?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCoachMessage(); } }}
                  className="min-h-[48px] max-h-[100px]"
                />
                <Button onClick={sendCoachMessage} disabled={chatLoading || !chatInput.trim()} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Habits */}
        <TabsContent value="habits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-violet-400" />
                Hábitos diarios
              </CardTitle>
              <CardDescription>Streaks automáticos — consistencia sobre perfección</CardDescription>
            </CardHeader>
            <CardContent>
              {habits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tienes hábitos configurados aún</p>
                  <p className="text-xs mt-1">Configúralos desde la sección Coach principal</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {habits.map((habit) => (
                    <div key={habit.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => completeHabit(habit.name)}
                        >
                          <CheckCircle2 className={cn(
                            "h-5 w-5",
                            habit.last_completed_at && new Date(habit.last_completed_at).toDateString() === new Date().toDateString()
                              ? "text-emerald-400"
                              : "text-muted-foreground"
                          )} />
                        </Button>
                        <span className="text-sm font-medium">{habit.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-bold">{habit.streak || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights from PLAUD */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-amber-400" />
                Insights de mis conversaciones
              </CardTitle>
              <CardDescription>
                La IA analiza tus transcripciones PLAUD para detectar patrones de estrés, preocupaciones recurrentes y oportunidades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!insightsContent ? (
                <Button onClick={generateInsights} disabled={loadingInsights} className="w-full gap-2">
                  {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Analizar mis conversaciones
                </Button>
              ) : (
                <>
                  <ScrollArea className="max-h-[500px] pr-2">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{insightsContent}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                  <Button variant="outline" onClick={generateInsights} disabled={loadingInsights} className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" /> Regenerar insights
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default CoachLife;
