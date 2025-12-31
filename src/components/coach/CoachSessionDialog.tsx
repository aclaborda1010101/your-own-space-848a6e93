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
} from "lucide-react";
import { useJarvisCoach, EmotionalState, CoachMessage } from "@/hooks/useJarvisCoach";
import { CheckInData } from "@/components/dashboard/CheckInCard";

interface CoachSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInData?: CheckInData;
}

const protocolConfig: Record<string, { label: string; color: string; icon: typeof Brain }> = {
  anxiety: { label: "Ansiedad", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  block: { label: "Bloqueo", color: "bg-warning/20 text-warning", icon: Brain },
  push: { label: "Empuje", color: "bg-success/20 text-success", icon: Zap },
  tired: { label: "Cansancio", color: "bg-chart-4/20 text-chart-4", icon: Battery },
  crisis: { label: "Crisis", color: "bg-destructive/20 text-destructive", icon: Heart },
  balanced: { label: "Equilibrado", color: "bg-primary/20 text-primary", icon: Brain },
};

export const CoachSessionDialog = ({ open, onOpenChange, checkInData }: CoachSessionDialogProps) => {
  const {
    session,
    loading,
    startSession,
    sendMessage,
    updateEmotionalState,
    endSession,
  } = useJarvisCoach();

  const [inputMessage, setInputMessage] = useState("");
  const [showEmotionalCheck, setShowEmotionalCheck] = useState(true);
  const [emotionalState, setEmotionalState] = useState<EmotionalState>({
    energy: checkInData?.energy ? checkInData.energy * 2 : 5,
    mood: checkInData?.mood ? checkInData.mood * 2 : 5,
    stress: 5,
    anxiety: 3,
    motivation: 5,
  });
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
      setShowEmotionalCheck(true);
      setEmotionalState({
        energy: checkInData?.energy ? checkInData.energy * 2 : 5,
        mood: checkInData?.mood ? checkInData.mood * 2 : 5,
        stress: 5,
        anxiety: 3,
        motivation: 5,
      });
    }
  }, [open, session, checkInData]);

  const handleStartSession = async () => {
    startSession("daily", emotionalState);
    setShowEmotionalCheck(false);
    
    // Send initial greeting
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

  const handleClose = async () => {
    if (session && session.messages.length > 0) {
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
          {showEmotionalCheck ? (
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

              <div className="p-4 border-t border-border">
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
