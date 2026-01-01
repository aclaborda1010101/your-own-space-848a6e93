import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { BookOpen, CheckCircle2, X, Volume2, ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChunksPracticeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const CHUNKS = [
  { en: "I'm looking forward to", es: "Tengo ganas de / Estoy deseando", example: "I'm looking forward to the weekend." },
  { en: "It's worth it", es: "Vale la pena", example: "The long drive is worth it." },
  { en: "I'm about to", es: "Estoy a punto de", example: "I'm about to leave the office." },
  { en: "It depends on", es: "Depende de", example: "It depends on the weather." },
  { en: "I'm used to", es: "Estoy acostumbrado a", example: "I'm used to waking up early." },
  { en: "As far as I know", es: "Que yo sepa", example: "As far as I know, the meeting is at 3 PM." },
  { en: "I'd rather", es: "Preferiría", example: "I'd rather stay home tonight." },
  { en: "It turns out that", es: "Resulta que", example: "It turns out that he was right." },
  { en: "No wonder", es: "No me extraña / Con razón", example: "No wonder you're tired, you didn't sleep!" },
  { en: "I can't help but", es: "No puedo evitar", example: "I can't help but smile when I see her." },
];

export function ChunksPractice({ open, onOpenChange, onComplete }: ChunksPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const { speak, isSupported } = useSpeechSynthesis();
  const currentChunk = CHUNKS[currentIndex];
  const progress = (currentIndex / CHUNKS.length) * 100;

  useEffect(() => {
    if (!open) {
      setCurrentIndex(0);
      setUserInput("");
      setShowAnswer(false);
      setResults([]);
      setIsComplete(false);
    }
  }, [open]);

  const checkAnswer = () => {
    setShowAnswer(true);
    // Simple check - contains any of the Spanish translations
    const isCorrect = currentChunk.es.toLowerCase().split('/').some(
      part => userInput.toLowerCase().trim().includes(part.trim())
    );
    setResults([...results, { correct: isCorrect }]);
  };

  const handleNext = () => {
    if (currentIndex < CHUNKS.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput("");
      setShowAnswer(false);
    } else {
      setIsComplete(true);
      onComplete();
    }
  };

  const correctCount = results.filter(r => r.correct).length;

  if (isComplete) {
    const percentage = Math.round((correctCount / results.length) * 100);
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center space-y-6">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto flex items-center justify-center",
              percentage >= 70 ? "bg-success/20" : "bg-warning/20"
            )}>
              <Trophy className={cn(
                "w-10 h-10",
                percentage >= 70 ? "text-success" : "text-warning"
              )} />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">
                {percentage >= 70 ? "¡Excelente!" : "¡Sigue practicando!"}
              </h2>
              <p className="text-4xl font-bold text-primary mt-2">
                {correctCount} / {results.length}
              </p>
              <p className="text-muted-foreground">chunks correctos</p>
            </div>

            <Button onClick={() => onOpenChange(false)}>
              Finalizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Práctica de Chunks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{currentIndex + 1} / {CHUNKS.length}</Badge>
            <span className="text-sm text-muted-foreground">
              <span className="text-success">{correctCount}</span> correctos
            </span>
          </div>

          <Progress value={progress} />

          <div className="p-6 rounded-lg border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Inglés → Español</Badge>
              {isSupported && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => speak(currentChunk.en)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <p className="text-2xl font-bold text-center py-4">{currentChunk.en}</p>

            {!showAnswer ? (
              <div className="space-y-3">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Escribe la traducción en español..."
                  onKeyDown={(e) => e.key === "Enter" && userInput && checkAnswer()}
                />
                <Button onClick={checkAnswer} disabled={!userInput} className="w-full">
                  Comprobar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={cn(
                  "p-4 rounded-lg",
                  results[results.length - 1]?.correct ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {results[results.length - 1]?.correct ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">
                      {results[results.length - 1]?.correct ? "¡Correcto!" : "Respuesta correcta:"}
                    </span>
                  </div>
                  <p className="font-medium">{currentChunk.es}</p>
                </div>

                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Ejemplo:</p>
                  <p className="italic">"{currentChunk.example}"</p>
                </div>

                <Button onClick={handleNext} className="w-full gap-2">
                  {currentIndex < CHUNKS.length - 1 ? (
                    <>
                      Siguiente <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Ver resultados"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
