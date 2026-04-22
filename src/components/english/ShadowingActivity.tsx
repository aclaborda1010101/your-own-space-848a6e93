import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { Headphones, Play, Pause, RotateCcw, CheckCircle2, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ShadowingActivityProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const FALLBACK_SENTENCES = [
  { text: "I'm really looking forward to our meeting next week.", translation: "Tengo muchas ganas de nuestra reunión la próxima semana." },
  { text: "Could you please send me the report by Friday?", translation: "¿Podrías enviarme el informe para el viernes?" },
  { text: "That's a great point, I hadn't considered that before.", translation: "Es un gran punto, no lo había considerado antes." },
  { text: "Let me think about it and get back to you tomorrow.", translation: "Déjame pensarlo y te respondo mañana." },
  { text: "I completely agree with what you're saying.", translation: "Estoy completamente de acuerdo con lo que dices." },
];

export function ShadowingActivity({ open, onOpenChange, onComplete }: ShadowingActivityProps) {
  const { session } = useAuth();
  const [sentences, setSentences] = useState(FALLBACK_SENTENCES);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);

  const { speak, isSpeaking, isSupported, stop } = useSpeechSynthesis();
  const currentSentence = sentences[currentIndex];
  const progress = (completed.length / sentences.length) * 100;

  useEffect(() => {
    if (open && session) {
      setCurrentIndex(0);
      setCompleted([]);
      setShowTranslation(false);
      loadAISentences();
    }
  }, [open]);

  const loadAISentences = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: { action: "generate_shadowing", userLevel: "B2" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data?.sentences?.length > 0) {
        setSentences(data.sentences);
      }
    } catch (e) {
      console.error("[ShadowingActivity] AI load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (isSpeaking) {
      stop();
      setIsPlaying(false);
    } else {
      speak(currentSentence.text);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!isSpeaking && isPlaying) {
      setIsPlaying(false);
    }
  }, [isSpeaking, isPlaying]);

  const handleMarkComplete = () => {
    if (!completed.includes(currentIndex)) {
      setCompleted([...completed, currentIndex]);
    }

    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowTranslation(false);
    } else if (completed.length + 1 === sentences.length) {
      onComplete();
      onOpenChange(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowTranslation(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowTranslation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            Shadowing Practice
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando frases personalizadas...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{currentIndex + 1} / {sentences.length}</Badge>
              <span className="text-sm text-muted-foreground">{completed.length} completadas</span>
            </div>

            <Progress value={progress} />

            <div className="p-6 rounded-lg border bg-card space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-medium leading-relaxed flex-1">
                  {currentSentence.text}
                </p>
                {isSupported && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePlay}
                    className="shrink-0"
                  >
                    {isSpeaking ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>

              {showTranslation ? (
                <p className="text-muted-foreground italic">{currentSentence.translation}</p>
              ) : (
                <Button variant="link" className="p-0 h-auto" onClick={() => setShowTranslation(true)}>
                  Ver traducción
                </Button>
              )}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>1. Escucha la frase</p>
              <p>2. Repítela en voz alta imitando la pronunciación</p>
              <p>3. Marca como completada cuando te sientas seguro</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
                Anterior
              </Button>
              <Button variant="outline" onClick={handleNext} disabled={currentIndex === sentences.length - 1} className="flex-1">
                Siguiente
              </Button>
              <Button onClick={handleMarkComplete} className={cn(
                "gap-2",
                completed.includes(currentIndex) && "bg-success hover:bg-success/90"
              )}>
                {completed.includes(currentIndex) ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Hecho
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Completar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
