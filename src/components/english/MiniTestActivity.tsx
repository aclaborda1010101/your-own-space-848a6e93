import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PenTool, CheckCircle2, X, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MiniTestActivityProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const FALLBACK_QUESTIONS = [
  {
    question: "Complete: 'I'm really looking _____ to the weekend.'",
    options: ["forward", "ahead", "front", "toward"],
    correct: 0,
    explanation_es: "'Look forward to' es una expresión fija que significa 'tener ganas de'."
  },
  {
    question: "Which phrase means 'Vale la pena'?",
    options: ["It's worth doing", "It's worth it", "It's worthy", "It worths"],
    correct: 1,
    explanation_es: "'It's worth it' es la forma correcta. 'Worth' nunca se conjuga como verbo."
  },
  {
    question: "Complete: 'I'm _____ to working from home.'",
    options: ["use", "using", "used", "usual"],
    correct: 2,
    explanation_es: "'Be used to + gerund' significa estar acostumbrado a algo."
  },
  {
    question: "'It depends on the weather' - ¿Qué significa?",
    options: ["El tiempo depende", "Depende del clima", "El clima decide", "Según el tiempo"],
    correct: 1,
    explanation_es: "'Depend on' siempre va seguido de 'on' y significa 'depender de'."
  },
  {
    question: "Which is correct?",
    options: ["I'm about leaving", "I'm about to leave", "I'm about leave", "I about to leave"],
    correct: 1,
    explanation_es: "'Be about to + infinitive' expresa algo inminente."
  }
];

export function MiniTestActivity({ open, onOpenChange, onComplete }: MiniTestActivityProps) {
  const { session } = useAuth();
  const [questions, setQuestions] = useState(FALLBACK_QUESTIONS);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;

  useEffect(() => {
    if (open && session) {
      setCurrentIndex(0);
      setSelectedOption(null);
      setShowResult(false);
      setResults([]);
      setIsComplete(false);
      loadAIQuestions();
    }
  }, [open]);

  const loadAIQuestions = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-english-pro", {
        body: { action: "generate_mini_test", userLevel: "B2" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data?.questions?.length > 0) {
        setQuestions(data.questions);
      }
    } catch (e) {
      console.error("[MiniTestActivity] AI load error:", e);
    } finally {
      setLoading(false);
    }
  };

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
    if (currentIndex < questions.length - 1) {
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando test personalizado...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{currentIndex + 1} / {questions.length}</Badge>
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

            {showResult && currentQuestion.explanation_es && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">{currentQuestion.explanation_es}</p>
              </div>
            )}

            {!showResult ? (
              <Button onClick={handleCheck} disabled={selectedOption === null} className="w-full">
                Comprobar
              </Button>
            ) : (
              <Button onClick={handleNext} className="w-full">
                {currentIndex < questions.length - 1 ? "Siguiente" : "Ver resultados"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
