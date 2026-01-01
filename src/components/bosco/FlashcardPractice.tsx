import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { 
  RotateCcw, 
  Check, 
  X, 
  ArrowRight,
  Trophy,
  Sparkles,
  Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VocabularyWord } from "@/hooks/useBosco";

interface FlashcardPracticeProps {
  words: VocabularyWord[];
  onComplete: (wordsPracticed: string[], correctCount: number, totalCount: number) => void;
  onPracticeWord: (wordId: string, correct: boolean) => void;
  onCancel: () => void;
}

export function FlashcardPractice({ 
  words, 
  onComplete, 
  onPracticeWord, 
  onCancel 
}: FlashcardPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEnToEs, setIsEnToEs] = useState(true);
  const [results, setResults] = useState<{ wordId: string; correct: boolean }[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const { speak, isSpeaking, isSupported } = useSpeechSynthesis();

  const currentWord = words[currentIndex];
  const progress = ((currentIndex) / words.length) * 100;
  const correctCount = results.filter(r => r.correct).length;

  // Auto-speak word when showing English
  const speakCurrentWord = () => {
    if (isSupported && currentWord) {
      speak(currentWord.word_en);
    }
  };

  useEffect(() => {
    // Randomize direction for each card
    setIsEnToEs(Math.random() > 0.5);
  }, [currentIndex]);

  const handleFlip = () => {
    if (!isAnimating) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleAnswer = async (correct: boolean) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setShowResult(correct ? 'correct' : 'incorrect');
    
    await onPracticeWord(currentWord.id, correct);
    
    const newResults = [...results, { wordId: currentWord.id, correct }];
    setResults(newResults);

    // Wait for animation
    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setShowResult(null);
        setIsAnimating(false);
      } else {
        // Game complete
        setIsComplete(true);
        onComplete(
          newResults.map(r => r.wordId),
          newResults.filter(r => r.correct).length,
          newResults.length
        );
      }
    }, 600);
  };

  if (isComplete) {
    const finalCorrect = results.filter(r => r.correct).length;
    const percentage = Math.round((finalCorrect / results.length) * 100);
    
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12 text-center">
          <div className="animate-scale-in">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
              percentage >= 80 ? "bg-success/20" : percentage >= 50 ? "bg-warning/20" : "bg-destructive/20"
            )}>
              {percentage >= 80 ? (
                <Trophy className="w-10 h-10 text-success" />
              ) : (
                <Sparkles className="w-10 h-10 text-warning" />
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {percentage >= 80 ? "¡Excelente!" : percentage >= 50 ? "¡Bien hecho!" : "¡Sigue practicando!"}
            </h2>
            
            <p className="text-4xl font-bold text-primary mb-2">
              {finalCorrect} / {results.length}
            </p>
            <p className="text-muted-foreground mb-6">
              {percentage}% de aciertos
            </p>
            
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onCancel}>
                Volver al vocabulario
              </Button>
              <Button onClick={() => {
                setCurrentIndex(0);
                setResults([]);
                setIsFlipped(false);
                setShowResult(null);
                setIsAnimating(false);
                setIsComplete(false);
              }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Jugar de nuevo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Práctica de Flashcards</CardTitle>
          <Badge variant="secondary">
            {currentIndex + 1} / {words.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      
      <CardContent className="space-y-6 pb-6">
        {/* Flashcard */}
        <div 
          className="perspective-1000 cursor-pointer"
          onClick={handleFlip}
        >
          <div 
            className={cn(
              "relative w-full h-64 transition-all duration-500 transform-style-3d",
              isFlipped && "rotate-y-180",
              showResult === 'correct' && "animate-pulse ring-4 ring-success/50 rounded-xl",
              showResult === 'incorrect' && "animate-pulse ring-4 ring-destructive/50 rounded-xl"
            )}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* Front of card */}
            <div 
              className={cn(
                "absolute inset-0 w-full h-full rounded-xl border-2 border-border bg-gradient-to-br from-card to-muted/50 flex flex-col items-center justify-center p-6 backface-hidden",
                showResult === 'correct' && "border-success bg-success/5",
                showResult === 'incorrect' && "border-destructive bg-destructive/5"
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p className="text-sm text-muted-foreground mb-3">
                {isEnToEs ? "Inglés → Español" : "Español → Inglés"}
              </p>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-4xl font-bold text-foreground text-center">
                  {isEnToEs ? currentWord?.word_en : currentWord?.word_es}
                </p>
                {isSupported && isEnToEs && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakCurrentWord();
                    }}
                    disabled={isSpeaking}
                  >
                    <Volume2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
              {currentWord?.category && (
                <Badge variant="outline" className="mt-4">
                  {currentWord.category}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-6 animate-pulse">
                Toca para ver la respuesta
              </p>
            </div>
            
            {/* Back of card */}
            <div 
              className={cn(
                "absolute inset-0 w-full h-full rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center p-6 backface-hidden rotate-y-180",
                showResult === 'correct' && "border-success bg-success/10",
                showResult === 'incorrect' && "border-destructive bg-destructive/10"
              )}
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <p className="text-sm text-muted-foreground mb-3">
                {isEnToEs ? "Español" : "Inglés"}
              </p>
              <p className="text-4xl font-bold text-primary text-center">
                {isEnToEs ? currentWord?.word_es : currentWord?.word_en}
              </p>
              
              {showResult && (
                <div className={cn(
                  "mt-4 flex items-center gap-2 animate-scale-in",
                  showResult === 'correct' ? "text-success" : "text-destructive"
                )}>
                  {showResult === 'correct' ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span className="font-medium">¡Correcto!</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5" />
                      <span className="font-medium">A seguir practicando</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Answer buttons - only show when flipped */}
        {isFlipped && !showResult && (
          <div className="flex gap-4 justify-center animate-fade-in">
            <Button 
              variant="outline" 
              size="lg"
              className="flex-1 max-w-32 border-destructive/50 hover:bg-destructive/10 hover:border-destructive"
              onClick={() => handleAnswer(false)}
              disabled={isAnimating}
            >
              <X className="w-5 h-5 mr-2 text-destructive" />
              No lo sabía
            </Button>
            <Button 
              size="lg"
              className="flex-1 max-w-32 bg-success hover:bg-success/90"
              onClick={() => handleAnswer(true)}
              disabled={isAnimating}
            >
              <Check className="w-5 h-5 mr-2" />
              ¡Lo sabía!
            </Button>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-success">
              <Check className="w-4 h-4" />
              {correctCount}
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <X className="w-4 h-4" />
              {results.length - correctCount}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
