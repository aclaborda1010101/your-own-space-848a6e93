import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertCircle,
  Brain,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  assessment: string;
  patterns: string[];
  recommendations: Array<{
    title: string;
    description: string;
    type: "activity" | "conversation" | "routine" | "environment";
    difficulty: "easy" | "moderate" | "challenging";
  }>;
  redFlags: Array<{
    flag: string;
    severity: "mild" | "moderate" | "significant";
    action?: string;
  }>;
  confidence: number;
}

export default function BoscoAnalysis() {
  const { isOpen: sidebarOpen, open: openSidebar, close: closeSidebar, isCollapsed, toggleCollapse } = useSidebarState();
  
  // Form state
  const [observationNotes, setObservationNotes] = useState("");
  const [moodScore, setMoodScore] = useState<number>(5);
  const [socialInteraction, setSocialInteraction] = useState("");
  const [concerns, setConcerns] = useState("");
  const [questions, setQuestions] = useState("");
  
  // Analysis state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!observationNotes.trim()) {
      setError("Por favor, escribe tus observaciones de Bosco");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the Bosco analysis edge function
      const response = await fetch(
        "https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/jarvis-bosco-analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            observation_notes: observationNotes,
            mood_score: moodScore,
            social_interaction: socialInteraction,
            concerns: concerns ? concerns.split(",").map(c => c.trim()) : [],
            follow_up_questions: questions ? questions.split("\n").filter(q => q.trim()) : [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.analysis) {
        throw new Error("No analysis received");
      }

      // Save to database
      const { data: session, error: dbError } = await supabase
        .from("bosco_analysis_sessions")
        .insert({
          observation_notes: observationNotes,
          mood_score: moodScore,
          social_interaction: socialInteraction || null,
          parent_concerns: concerns ? { items: concerns.split(",") } : null,
          follow_up_questions: questions ? questions.split("\n") : [],
          assessment: data.analysis.assessment,
          developmental_stage: data.analysis.developmental_stage,
          pattern_identified: data.analysis.patterns?.join(", ") || null,
          recommendations: data.analysis.recommendations,
          red_flags: data.analysis.redFlags,
          confidence_score: data.analysis.confidence,
          model_used: data.model || "gemini-2.0-flash",
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database save error:", dbError);
        // Continue even if DB fails - show the analysis
      } else {
        setSessionId(session.id);
      }

      setResult(data.analysis);
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error generating analysis";
      setError(message);
      console.error("Analysis error:", err);
    } finally {
      setLoading(false);
    }
  }, [observationNotes, moodScore, socialInteraction, concerns, questions]);

  const handleNewAnalysis = useCallback(() => {
    setShowForm(true);
    setResult(null);
    setSessionId(null);
    setObservationNotes("");
    setMoodScore(5);
    setSocialInteraction("");
    setConcerns("");
    setQuestions("");
    setError(null);
  }, []);

  const handleSaveImplementation = useCallback(async (recIndex: number, status: string) => {
    if (!result || !sessionId) return;

    try {
      await supabase
        .from("bosco_recommendation_log")
        .insert({
          session_id: sessionId,
          recommendation_title: result.recommendations[recIndex].title,
          recommendation_text: result.recommendations[recIndex].description,
          recommendation_type: result.recommendations[recIndex].type,
          difficulty_level: result.recommendations[recIndex].difficulty,
          implementation_status: status,
        });
    } catch (err) {
      console.error("Error saving recommendation:", err);
    }
  }, [result, sessionId]);

  return (
    <div className="flex h-screen bg-slate-950">
      <SidebarNew isOpen={sidebarOpen} onClose={closeSidebar} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={openSidebar} />
        
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-8 h-8 text-purple-500" />
                <h1 className="text-3xl font-bold text-white">Análisis Profundo de Bosco</h1>
              </div>
              <p className="text-slate-300">Análisis de patrones, comportamiento y recomendaciones personalizadas</p>
            </div>

            {/* Error Display */}
            {error && (
              <Card className="mb-6 border-red-500/50 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-red-200">Error</p>
                      <p className="text-red-100 text-sm">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input Form */}
            {showForm && (
              <Card className="mb-6 border-slate-700 bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-white">Nueva Observación</CardTitle>
                  <CardDescription>Describe el comportamiento, emociones y contexto de Bosco</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Observation Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Observaciones Detalladas *
                    </label>
                    <Textarea
                      value={observationNotes}
                      onChange={(e) => setObservationNotes(e.target.value)}
                      placeholder="Describe lo que observaste: comportamiento, reacciones emocionales, interacciones sociales, eventos que lo desencadenaron..."
                      className="min-h-32 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>

                  {/* Mood Score */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Humor General (1-10)
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={moodScore}
                        onChange={(e) => setMoodScore(parseInt(e.target.value))}
                        className="flex-1"
                        disabled={loading}
                      />
                      <div className="text-2xl font-bold text-purple-400 w-12 text-right">{moodScore}</div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>Muy molesto</span>
                      <span>Muy feliz</span>
                    </div>
                  </div>

                  {/* Social Interaction */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Interacción Social (opcional)
                    </label>
                    <Input
                      value={socialInteraction}
                      onChange={(e) => setSocialInteraction(e.target.value)}
                      placeholder="¿Con quién estaba? ¿Cómo interactuó con otros?"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>

                  {/* Concerns */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Preocupaciones (opcional)
                    </label>
                    <Input
                      value={concerns}
                      onChange={(e) => setConcerns(e.target.value)}
                      placeholder="Escribe preocupaciones separadas por comas (ej: no duerme bien, come poco, ansiedad)"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>

                  {/* Questions */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Preguntas de Seguimiento (opcional)
                    </label>
                    <Textarea
                      value={questions}
                      onChange={(e) => setQuestions(e.target.value)}
                      placeholder="Escribe preguntas específicas (una por línea)"
                      className="min-h-20 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !observationNotes.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-2" />
                        Generar Análisis
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Analysis Results */}
            {result && (
              <div className="space-y-6">
                {/* Assessment */}
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Evaluación General
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-200 leading-relaxed">{result.assessment}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-sm text-slate-400">Confianza del análisis:</span>
                      <Badge variant="outline" className="text-blue-300 border-blue-500">
                        {Math.round(result.confidence * 100)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Patterns */}
                {result.patterns && result.patterns.length > 0 && (
                  <Card className="border-slate-700 bg-slate-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        Patrones Identificados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {result.patterns.map((pattern, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                            <p className="text-slate-200">{pattern}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <Card className="border-slate-700 bg-slate-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Lightbulb className="w-5 h-5 text-yellow-500" />
                        Recomendaciones Personalizadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {result.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-4 bg-slate-800 rounded-lg space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-white">{rec.title}</p>
                                <p className="text-sm text-slate-300 mt-1">{rec.description}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Badge variant="outline" className={cn(
                                  "text-xs",
                                  rec.difficulty === "easy" ? "text-green-300 border-green-500" : "",
                                  rec.difficulty === "moderate" ? "text-yellow-300 border-yellow-500" : "",
                                  rec.difficulty === "challenging" ? "text-red-300 border-red-500" : "",
                                )}>
                                  {rec.difficulty}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-purple-300 border-purple-500">
                                  {rec.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveImplementation(idx, "in_progress")}
                                className="text-xs"
                              >
                                Implementar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Red Flags */}
                {result.redFlags && result.redFlags.length > 0 && (
                  <Card className="border-red-500/50 bg-red-500/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-200">
                        <AlertCircle className="w-5 h-5" />
                        Aspectos a Monitores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {result.redFlags.map((flag, idx) => (
                          <div key={idx} className="p-3 bg-slate-800 rounded-lg border-l-4 border-red-500">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-red-200">{flag.flag}</p>
                                {flag.action && <p className="text-sm text-red-100 mt-1">{flag.action}</p>}
                              </div>
                              <Badge className={cn(
                                "text-xs flex-shrink-0",
                                flag.severity === "mild" ? "bg-yellow-900 text-yellow-200" : "",
                                flag.severity === "moderate" ? "bg-orange-900 text-orange-200" : "",
                                flag.severity === "significant" ? "bg-red-900 text-red-200" : "",
                              )}>
                                {flag.severity}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center pt-6">
                  <Button
                    onClick={handleNewAnalysis}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nuevo Análisis
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && !result && (
              <Card className="border-slate-700 bg-slate-900">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <Spinner className="w-8 h-8 text-purple-500" />
                    <p className="text-slate-300">Analizando observaciones de Bosco...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
