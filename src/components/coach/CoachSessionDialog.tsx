import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Send,
  Loader2,
  Heart,
  Battery,
  Flame,
  AlertTriangle,
  Zap,
  X,
  Save,
  CheckCircle2,
  Clock,
  MessageSquare,
  Target,
  Shield,
} from "lucide-react";
import { useJarvisCoach, EmotionalState, CoachMessage } from "@/hooks/useJarvisCoach";
import { CheckInData } from "@/components/dashboard/CheckInCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type SessionPhase = "type-selection" | "emotional-check" | "chat" | "summary";

interface SessionSummary {
  summary: string;
  insights: string[];
  commitments: string[];
  mood_shift: string;
  next_session_suggestion: string;
}

const SESSION_TYPE_OPTIONS = [
  { id: "check-in", label: "Check-in", description: "Evalúa tu estado y define acciones", duration: "15 min", icon: MessageSquare },
  { id: "deep-dive", label: "Sesión profunda", description: "Explora patrones y creencias", duration: "30 min", icon: Brain },
  { id: "accountability", label: "Accountability", description: "Revisa compromisos y define nuevos", duration: "10 min", icon: Target },
  { id: "weekly-review", label: "Revisión semanal", description: "Analiza tu semana y planifica", duration: "20 min", icon: Clock },
  { id: "crisis", label: "Apoyo inmediato", description: "Cuando necesitas soporte urgente", duration: "10 min", icon: Shield },
];

interface CoachSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInData?: CheckInData;
  initialSessionType?: string;
}

const protocolConfig: Record<string, { label: string; color: string; icon: typeof Brain }> = {
  anxiety: { label: "Ansiedad", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  block: { label: "Bloqueo", color: "bg-warning/20 text-warning", icon: Brain },
  push: { label: "Empuje", color: "bg-success/20 text-success", icon: Zap },
  tired: { label: "Cansancio", color: "bg-chart-4/20 text-chart-4", icon: Battery },
  crisis: { label: "Crisis", color: "bg-destructive/20 text-destructive", icon: Heart },
  balanced: { label: "Equilibrado", color: "bg-primary/20 text-primary", icon: Brain },
};

export const CoachSessionDialog = ({ open, onOpenChange, checkInData, initialSessionType }: CoachSessionDialogProps) => {
  const { session: authSession } = useAuth();
  const {
    session,
    loading,
    startSession,
    sendMessage,
    updateEmotionalState,
    endSession,
  } = useJarvisCoach();

  const [inputMessage, setInputMessage] = useState("");
  const [phase, setPhase] = useState<SessionPhase>("type-selection");
  const [selectedSessionType, setSelectedSessionType] = useState(initialSessionType || "check-in");
  const [emotionalState, setEmotionalState] = useState<EmotionalState>({
    energy: checkInData?.energy ? checkInData.energy * 2 : 5,
    mood: checkInData?.mood ? checkInData.mood * 2 : 5,
    stress: 5,
    anxiety: 3,
    motivation: 5,
  });
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages]);

  // Reset when dialog opens
  useEffect(() => {
    if (open && !session) {
      setPhase(initialSessionType ? "emotional-check" : "type-selection");
      setSelectedSessionType(initialSessionType || "check-in");
      setSessionSummary(null);
      setEmotionalState({
        energy: checkInData?.energy ? checkInData.energy * 2 : 5,
        mood: checkInData?.mood ? checkInData.mood * 2 : 5,
        stress: 5,
        anxiety: 3,
        motivation: 5,
      });
    }
  }, [open, session, checkInData, initialSessionType]);

  const handleSelectSessionType = (typeId: string) => {
    setSelectedSessionType(typeId);
    setPhase("emotional-check");
  };

  const handleStartSession = async () => {
    startSession(selectedSessionType, emotionalState);
    setPhase("chat");

    // Send initial greeting with session type context
    await sendMessage("Hola JARVIS, estoy listo para nuestra sesión.", {
      checkInData: checkInData ? {
        energy: checkInData.energy,
        mood: checkInData.mood,
        focus: checkInData.focus,
      } : undefined,
      dayMode: checkInData?.dayMode || "balanced",
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const message = inputMessage;
    setInputMessage("");

    await sendMessage(message, {
      checkInData: checkInData ? {
        energy: checkInData.energy,
        mood: checkInData.mood,
        focus: checkInData.focus,
      } : undefined,
      dayMode: checkInData?.dayMode || "balanced",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEndSession = async () => {
    setLoadingSummary(true);
    try {
      // Call end_session mode to get structured summary
      const { data, error } = await supabase.functions.invoke("jarvis-coach", {
        body: {
          mode: "end_session",
          sessionType: selectedSessionType,
          messages: session?.messages || [],
          emotionalState,
        },
        headers: authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {},
      });

      if (!error && data?.summary) {
        setSessionSummary(data);
      } else {
        setSessionSummary({
          summary: "Sesión completada correctamente.",
          insights: [],
          commitments: [],
          mood_shift: "estable",
          next_session_suggestion: "Continúa con tu próxima sesión regular.",
        });
      }
    } catch (e) {
      console.error("Error ending session:", e);
      setSessionSummary({
        summary: "Sesión completada.",
        insights: [],
        commitments: [],
        mood_shift: "estable",
        next_session_suggestion: "Continúa con tu próxima sesión.",
      });
    } finally {
      setLoadingSummary(false);
      setPhase("summary");
      await endSession();
    }
  };

  const handleClose = async () => {
    if (session && session.messages.length > 0 && phase === "chat") {
      await endSession();
    }
    onOpenChange(false);
  };

  const protocolInfo = session?.protocol 
    ? protocolConfig[session.protocol] || protocolConfig.balanced
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              JARVIS Coach
            </DialogTitle>
            {protocolInfo && (
              <Badge variant="outline" className={protocolInfo.color}>
                <protocolInfo.icon className="w-3 h-3 mr-1" />
                {protocolInfo.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {phase === "type-selection" ? (
            // Session Type Selection
            <div className="p-4 space-y-4 overflow-auto">
              <div className="text-center space-y-2">
                <h3 className="font-medium text-foreground">¿Qué tipo de sesión necesitas?</h3>
                <p className="text-sm text-muted-foreground">
                  Elige según lo que necesites hoy
                </p>
              </div>
              <div className="space-y-2">
                {SESSION_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectSessionType(opt.id)}
                      className={cn(
                        "w-full p-4 rounded-lg border text-left transition-all hover:bg-muted/50",
                        selectedSessionType === opt.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{opt.duration}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : phase === "summary" ? (
            // Session Summary
            <div className="p-4 space-y-6 overflow-auto">
              {loadingSummary ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generando resumen...</p>
                </div>
              ) : sessionSummary ? (
                <>
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-success" />
                    </div>
                    <h3 className="font-medium text-foreground">Sesión completada</h3>
                  </div>

                  <div className="p-4 rounded-lg border bg-card space-y-2">
                    <p className="text-sm font-medium">Resumen</p>
                    <p className="text-sm text-muted-foreground">{sessionSummary.summary}</p>
                  </div>

                  {sessionSummary.insights.length > 0 && (
                    <div className="p-4 rounded-lg border bg-card space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" /> Insights
                      </p>
                      <ul className="space-y-1">
                        {sessionSummary.insights.map((insight, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-primary shrink-0">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sessionSummary.commitments.length > 0 && (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" /> Compromisos
                      </p>
                      <ul className="space-y-1">
                        {sessionSummary.commitments.map((commitment, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            {commitment}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sessionSummary.next_session_suggestion && (
                    <p className="text-xs text-muted-foreground text-center italic">
                      Próxima sesión: {sessionSummary.next_session_suggestion}
                    </p>
                  )}

                  <Button onClick={() => onOpenChange(false)} className="w-full">
                    Finalizar
                  </Button>
                </>
              ) : null}
            </div>
          ) : phase === "emotional-check" ? (
            // Emotional Check Screen
            <div className="p-4 space-y-6 overflow-auto">
              <div className="text-center space-y-2">
                <h3 className="font-medium text-foreground">¿Cómo te encuentras ahora?</h3>
                <p className="text-sm text-muted-foreground">
                  Ajusta los niveles para que pueda adaptar la sesión
                </p>
              </div>

              <div className="space-y-5">
                {/* Energy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium">Energía</span>
                    </div>
                    <span className="text-sm font-mono">{emotionalState.energy}/10</span>
                  </div>
                  <Slider
                    value={[emotionalState.energy]}
                    onValueChange={([v]) => setEmotionalState(s => ({ ...s, energy: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Mood */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">Ánimo</span>
                    </div>
                    <span className="text-sm font-mono">{emotionalState.mood}/10</span>
                  </div>
                  <Slider
                    value={[emotionalState.mood]}
                    onValueChange={([v]) => setEmotionalState(s => ({ ...s, mood: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Stress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-sm font-medium">Estrés</span>
                    </div>
                    <span className="text-sm font-mono">{emotionalState.stress}/10</span>
                  </div>
                  <Slider
                    value={[emotionalState.stress]}
                    onValueChange={([v]) => setEmotionalState(s => ({ ...s, stress: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Anxiety */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">Ansiedad</span>
                    </div>
                    <span className="text-sm font-mono">{emotionalState.anxiety}/10</span>
                  </div>
                  <Slider
                    value={[emotionalState.anxiety]}
                    onValueChange={([v]) => setEmotionalState(s => ({ ...s, anxiety: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Motivation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Motivación</span>
                    </div>
                    <span className="text-sm font-mono">{emotionalState.motivation}/10</span>
                  </div>
                  <Slider
                    value={[emotionalState.motivation]}
                    onValueChange={([v]) => setEmotionalState(s => ({ ...s, motivation: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </div>

              <Button onClick={handleStartSession} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Comenzar sesión
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Chat Screen
            <>
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {session?.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-3 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu mensaje..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || loading}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {session && session.messages.length >= 4 && (
                  <Button
                    variant="outline"
                    onClick={handleEndSession}
                    disabled={loading || loadingSummary}
                    className="w-full gap-2"
                  >
                    {loadingSummary ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Finalizar sesión
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
