import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PenTool, CheckCircle2, X, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniTestActivityProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const QUESTIONS = [
  {
    question: "Complete: 'I'm really looking _____ to the weekend.'",
    options: ["forward", "ahead", "front", "toward"],
    correct: 0
  },
  {
    question: "Which phrase means 'Vale la pena'?",
    options: ["It's worth doing", "It's worth it", "It's worthy", "It worths"],
    correct: 1
  },
  {
    question: "Complete: 'I'm _____ to working from home.'",
    options: ["use", "using", "used", "usual"],
    correct: 2
  },
  {
    question: "'It depends on the weather' - ¿Qué significa?",
    options: ["El tiempo depende", "Depende del clima", "El clima decide", "Según el tiempo"],
    correct: 1
  },
  {
    question: "Which is correct?",
    options: ["I'm about leaving", "I'm about to leave", "I'm about leave", "I about to leave"],
    correct: 1
  }
];

export function MiniTestActivity({ open, onOpenChange, onComplete }: MiniTestActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = QUESTIONS[currentIndex];
  const progress = (currentIndex / QUESTIONS.length) * 100;

  useEffect(() => {
    if (!open) {
      setCurrentIndex(0);
      setSelectedOption(null);
      setShowResult(false);
      setResults([]);
      setIsComplete(false);
    }
  }, [open]);

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
  };

  const handleCheck = () => {
    if (selectedOption === null) return;
    setShowResult(true);
    setResults([...results, selectedOption === currentQuestion.correct]);
  };

  const handleNext = () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setIsComplete(true);
      onComplete();
    }
  };

  const correctCount = results.filter(Boolean).length;

  if (isComplete) {
    const percentage = Math.round((correctCount / results.length) * 100);
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center space-y-6">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto flex items-center justify-center",
              percentage >= 80 ? "bg-success/20" : percentage >= 60 ? "bg-warning/20" : "bg-destructive/20"
            )}>
              <Trophy className={cn(
                "w-10 h-10",
                percentage >= 80 ? "text-success" : percentage >= 60 ? "text-warning" : "text-destructive"
              )} />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">
                {percentage >= 80 ? "¡Excelente!" : percentage >= 60 ? "¡Bien!" : "Sigue practicando"}
              </h2>
              <p className="text-4xl font-bold text-primary mt-2">
                {correctCount} / {results.length}
              </p>
              <p className="text-muted-foreground">{percentage}% de aciertos</p>
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
            <PenTool className="h-5 w-5 text-primary" />
            Mini Test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{currentIndex + 1} / {QUESTIONS.length}</Badge>
            <span className="text-sm text-muted-foreground">
              <span className="text-success">{correctCount}</span> correctas
            </span>
          </div>

          <Progress value={progress} />

          <div className="space-y-4">
            <p className="font-medium text-lg">{currentQuestion.question}</p>

            <div className="space-y-2">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={showResult}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-all",
                    selectedOption === i && !showResult && "border-primary bg-primary/5",
                    showResult && i === currentQuestion.correct && "border-success bg-success/10",
                    showResult && selectedOption === i && i !== currentQuestion.correct && "border-destructive bg-destructive/10",
                    !showResult && selectedOption !== i && "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {showResult && i === currentQuestion.correct && (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                    {showResult && selectedOption === i && i !== currentQuestion.correct && (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!showResult ? (
            <Button onClick={handleCheck} disabled={selectedOption === null} className="w-full">
              Comprobar
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-full">
              {currentIndex < QUESTIONS.length - 1 ? "Siguiente" : "Ver resultados"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
