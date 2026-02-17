import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import { useEnglishStats } from "@/hooks/useEnglishStats";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Languages, BookOpen, Mic, MessageSquare, PenTool, Play, Loader2,
  Target, Flame, TrendingUp, Volume2, Briefcase, Users, Award,
  RefreshCw, Send, ArrowRight, CheckCircle2, UtensilsCrossed,
  Handshake, BarChart3, Presentation,
} from "lucide-react";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const ROLEPLAY_SCENARIOS = [
  { id: "restaurant", label: "Restaurante", icon: UtensilsCrossed },
  { id: "meeting", label: "Reunión de trabajo", icon: Briefcase },
  { id: "networking", label: "Networking", icon: Handshake },
  { id: "interview", label: "Entrevista de trabajo", icon: Target },
  { id: "negotiation", label: "Negociación", icon: BarChart3 },
  { id: "presentation", label: "Presentación", icon: Presentation },
];

const CoachEnglish = () => {
  const { user } = useAuth();
  const { stats } = useEnglishStats();
  const [activeTab, setActiveTab] = useState("lesson");
  const [level, setLevel] = useState<string>("B1");
  const [lessonContent, setLessonContent] = useState<string>("");
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailCorrection, setEmailCorrection] = useState("");
  const [correctingEmail, setCorrectingEmail] = useState(false);

  const generateLesson = async () => {
    setGeneratingLesson(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: { action: "daily_lesson", level, userId: user?.id },
      });
      if (error) throw error;
      setLessonContent(data.content || data.response || "No se pudo generar la lección.");
      toast.success("Lección generada");
    } catch (e) {
      console.error(e);
      toast.error("Error generando lección");
    } finally {
      setGeneratingLesson(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: {
          action: "conversation",
          level,
          userId: user?.id,
          messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.content || data.response }]);
    } catch (e) {
      console.error(e);
      toast.error("Error en la conversación");
    } finally {
      setChatLoading(false);
    }
  };

  const correctEmail = async () => {
    if (!emailDraft.trim()) return;
    setCorrectingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: { action: "email_correction", level, userId: user?.id, text: emailDraft },
      });
      if (error) throw error;
      setEmailCorrection(data.content || data.response || "");
      toast.success("Email corregido");
    } catch (e) {
      console.error(e);
      toast.error("Error corrigiendo email");
    } finally {
      setCorrectingEmail(false);
    }
  };

  const startRoleplay = async (scenarioId: string) => {
    setChatMessages([]);
    setActiveTab("practice");
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: { action: "roleplay", level, userId: user?.id, scenario: scenarioId },
      });
      if (error) throw error;
      setChatMessages([{ role: "assistant", content: data.content || data.response }]);
    } catch (e) {
      console.error(e);
      toast.error("Error iniciando roleplay");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">English Coach</h1>
            <p className="text-muted-foreground text-sm">Krashen · Pimsleur · Cambridge CELTA/DELTA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Nivel:</span>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Flame, label: "Racha", value: stats?.streak_days || 0, color: "text-sky-400", bg: "bg-sky-500/15" },
          { icon: BookOpen, label: "Chunks", value: stats?.total_chunks_learned || 0, color: "text-emerald-400", bg: "bg-emerald-500/15" },
          { icon: MessageSquare, label: "Role plays", value: stats?.roleplay_sessions || 0, color: "text-violet-400", bg: "bg-violet-500/15" },
          { icon: Award, label: "Tests", value: stats?.mini_tests_completed || 0, color: "text-amber-400", bg: "bg-amber-500/15" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="lesson" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" /> Lección
          </TabsTrigger>
          <TabsTrigger value="practice" className="gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4" /> Práctica
          </TabsTrigger>
          <TabsTrigger value="roleplay" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-4 w-4" /> Role Play
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" /> Progreso
          </TabsTrigger>
        </TabsList>

        {/* Daily Lesson */}
        <TabsContent value="lesson" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-sky-400" />
                Sesión del día — {level}
              </CardTitle>
              <CardDescription>
                Micro-lección personalizada de 15-20 min: vocabulario, pronunciación IPA, diálogo situacional y gramática contextualizada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!lessonContent ? (
                <Button onClick={generateLesson} disabled={generatingLesson} className="w-full gap-2">
                  {generatingLesson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Generar lección de hoy
                </Button>
              ) : (
                <>
                  <ScrollArea className="max-h-[500px] pr-2">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{lessonContent}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                  <Button variant="outline" onClick={generateLesson} disabled={generatingLesson} className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" /> Generar otra lección
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Practice - Conversation */}
        <TabsContent value="practice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-violet-400" />
                Conversación con IA
              </CardTitle>
              <CardDescription>
                La IA solo habla en inglés, corrige errores inline y sugiere expresiones mejores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[350px] border rounded-xl p-4 bg-muted/30">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Escribe algo en inglés para empezar la conversación
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
                  placeholder="Write something in English..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  className="min-h-[48px] max-h-[100px]"
                />
                <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Writing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-400" />
                Escribir email profesional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Write your professional email draft here..."
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="min-h-[120px]"
              />
              <Button onClick={correctEmail} disabled={correctingEmail || !emailDraft.trim()} className="w-full gap-2">
                {correctingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
                Corregir y mejorar
              </Button>
              {emailCorrection && (
                <div className="border rounded-xl p-4 bg-emerald-500/5 border-emerald-500/20">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{emailCorrection}</ReactMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Play */}
        <TabsContent value="roleplay" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-400" />
                Role Play Profesional
              </CardTitle>
              <CardDescription>Elige un escenario y practica en una situación real</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ROLEPLAY_SCENARIOS.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-2.5"
                    onClick={() => startRoleplay(scenario.id)}
                  >
                    <scenario.icon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm">{scenario.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Mi Progreso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Vocabulario aprendido", value: stats?.total_chunks_learned || 0, unit: "chunks", max: 500 },
                { label: "Tiempo de práctica", value: stats?.total_practice_minutes || 0, unit: "min", max: 1000 },
                { label: "Shadowing completados", value: stats?.shadowing_sessions || 0, unit: "sesiones", max: 50 },
              ].map((item) => (
                <div key={item.label} className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.value} {item.unit}</span>
                  </div>
                  <Progress value={Math.min((item.value / item.max) * 100, 100)} />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Nivel actual</p>
                  <p className="text-2xl font-bold text-sky-400">{level}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Racha</p>
                  <p className="text-2xl font-bold text-amber-400">{stats?.streak_days || 0} días</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default CoachEnglish;
