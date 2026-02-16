import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Bot, BookOpen, Beaker, Newspaper, Map, Play, Loader2,
  Target, Flame, TrendingUp, CheckCircle2, RefreshCw, Award,
  Lightbulb, Rocket, Brain, Code, Sparkles,
} from "lucide-react";

const AI_LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const;

const DAILY_CHALLENGES = [
  { id: "prompt", label: "Escribe un prompt efectivo", icon: "✍️", difficulty: "Principiante" },
  { id: "agent", label: "Crea un agente que resuma emails", icon: "🤖", difficulty: "Intermedio" },
  { id: "rag", label: "Implementa un sistema RAG básico", icon: "🔍", difficulty: "Avanzado" },
  { id: "workflow", label: "Diseña un workflow con IA", icon: "⚙️", difficulty: "Intermedio" },
  { id: "finetune", label: "Conceptos de fine-tuning", icon: "🎯", difficulty: "Avanzado" },
  { id: "multimodal", label: "Usa IA con imágenes", icon: "🖼️", difficulty: "Principiante" },
];

const ROADMAP_MILESTONES = [
  { title: "Fundamentos de IA", description: "Qué es un LLM, tokens, prompts", progress: 80, level: "Principiante" },
  { title: "Prompt Engineering", description: "Técnicas avanzadas: chain-of-thought, few-shot", progress: 60, level: "Principiante" },
  { title: "APIs de IA", description: "OpenAI, Gemini, Anthropic: cómo usarlas", progress: 40, level: "Intermedio" },
  { title: "Agentes Autónomos", description: "Function calling, tool use, orquestación", progress: 20, level: "Intermedio" },
  { title: "RAG & Embeddings", description: "Búsqueda semántica, vectores, bases de datos vectoriales", progress: 10, level: "Avanzado" },
  { title: "Fine-tuning & Evaluación", description: "Personalizar modelos, métricas, benchmarks", progress: 0, level: "Avanzado" },
];

const CoachAI = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("lesson");
  const [level, setLevel] = useState<string>("Intermedio");
  const [lessonContent, setLessonContent] = useState("");
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [challengeResult, setChallengeResult] = useState("");
  const [runningChallenge, setRunningChallenge] = useState<string | null>(null);

  const generateLesson = async () => {
    setGeneratingLesson(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-course-lesson", {
        body: { level, userId: user?.id, action: "daily_lesson" },
      });
      if (error) throw error;
      setLessonContent(data.content || data.lesson || "No se pudo generar la lección.");
      toast.success("Lección generada");
    } catch (e) {
      console.error(e);
      toast.error("Error generando lección");
    } finally {
      setGeneratingLesson(false);
    }
  };

  const startChallenge = async (challengeId: string) => {
    setRunningChallenge(challengeId);
    setChallengeResult("");
    try {
      const challenge = DAILY_CHALLENGES.find((c) => c.id === challengeId);
      const { data, error } = await supabase.functions.invoke("ai-course-lesson", {
        body: { level, userId: user?.id, action: "challenge", challengeTitle: challenge?.label },
      });
      if (error) throw error;
      setChallengeResult(data.content || data.lesson || "");
      toast.success("Reto generado");
    } catch (e) {
      console.error(e);
      toast.error("Error generando reto");
    } finally {
      setRunningChallenge(null);
    }
  };

  return (
    <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🤖 AI Coach
          </h1>
          <p className="text-muted-foreground mt-1">
            De principiante a experto en inteligencia artificial
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Nivel:</span>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Racha</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Lecciones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Retos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="lesson" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" /> Lección
          </TabsTrigger>
          <TabsTrigger value="lab" className="gap-1.5 text-xs sm:text-sm">
            <Beaker className="h-4 w-4" /> Lab
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5 text-xs sm:text-sm">
            <Newspaper className="h-4 w-4" /> Recursos
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5 text-xs sm:text-sm">
            <Map className="h-4 w-4" /> Roadmap
          </TabsTrigger>
        </TabsList>

        {/* Lesson */}
        <TabsContent value="lesson" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-violet-400" />
                Lección del día — {level}
              </CardTitle>
              <CardDescription>
                Contenido adaptado: conceptos, ejemplos prácticos y ejercicios
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
                    <RefreshCw className="h-4 w-4" /> Otra lección
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lab */}
        <TabsContent value="lab" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-amber-400" />
                Laboratorio Práctico
              </CardTitle>
              <CardDescription>Reto del día: hazlo tú, la IA evalúa y mejora</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {DAILY_CHALLENGES.map((challenge) => (
                  <Button
                    key={challenge.id}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => startChallenge(challenge.id)}
                    disabled={runningChallenge === challenge.id}
                  >
                    {runningChallenge === challenge.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="text-2xl">{challenge.icon}</span>
                    )}
                    <span className="text-xs text-center">{challenge.label}</span>
                    <Badge variant="outline" className="text-[10px]">{challenge.difficulty}</Badge>
                  </Button>
                ))}
              </div>
              {challengeResult && (
                <div className="border rounded-xl p-4 bg-violet-500/5 border-violet-500/20">
                  <ScrollArea className="max-h-[400px]">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{challengeResult}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-sky-400" />
                Recursos curados de la semana
              </CardTitle>
              <CardDescription>Top artículos, papers y videos filtrados por nivel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { title: "Prompt Engineering Guide (OpenAI)", type: "📄 Artículo", level: "Principiante" },
                  { title: "Building AI Agents — Anthropic Cookbook", type: "📓 Tutorial", level: "Intermedio" },
                  { title: "Attention is All You Need — Paper", type: "📝 Paper", level: "Avanzado" },
                  { title: "3Blue1Brown: Neural Networks", type: "🎥 Video", level: "Principiante" },
                  { title: "LangChain RAG Tutorial", type: "📓 Tutorial", level: "Intermedio" },
                ].map((resource, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{resource.title}</p>
                      <p className="text-xs text-muted-foreground">{resource.type}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{resource.level}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roadmap */}
        <TabsContent value="roadmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-emerald-400" />
                Mi Roadmap de IA
              </CardTitle>
              <CardDescription>Camino de aprendizaje personalizado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ROADMAP_MILESTONES.map((milestone, i) => (
                <div key={i} className="p-4 rounded-xl border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {milestone.progress >= 80 ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : milestone.progress > 0 ? (
                        <Sparkles className="h-5 w-5 text-amber-400" />
                      ) : (
                        <Target className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">{milestone.title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{milestone.level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{milestone.description}</p>
                  <Progress value={milestone.progress} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default CoachAI;
