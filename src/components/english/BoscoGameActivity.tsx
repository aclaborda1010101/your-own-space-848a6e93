import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Baby, Gamepad2, BookOpen, Mic, Trophy, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoscoGameActivityProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type GameType = "simon-says" | "story-time" | "sing-along" | "word-hunt";

const GAMES: Record<GameType, {
  name: string;
  icon: typeof Gamepad2;
  instructions: string[];
  duration: string;
}> = {
  "simon-says": {
    name: "Simon Says",
    icon: Gamepad2,
    instructions: [
      "Di 'Simon says...' seguido de una instrucción en inglés",
      "Ejemplos: 'Simon says touch your nose', 'Simon says jump'",
      "Si no dices 'Simon says', Bosco no debe hacer la acción",
      "¡Haz las acciones tú también para que Bosco te imite!"
    ],
    duration: "5 min"
  },
  "story-time": {
    name: "Story Time",
    icon: BookOpen,
    instructions: [
      "Cuenta un cuento corto alternando inglés y español",
      "Ejemplo: 'Once upon a time, había un pequeño rabbit...'",
      "Deja que Bosco complete algunas palabras",
      "Usa gestos y voces divertidas"
    ],
    duration: "5 min"
  },
  "sing-along": {
    name: "Sing Along",
    icon: Mic,
    instructions: [
      "Canta 'Head, shoulders, knees and toes'",
      "O 'If you're happy and you know it, clap your hands'",
      "Haz los gestos mientras cantas",
      "¡Repite hasta que Bosco se la sepa!"
    ],
    duration: "5 min"
  },
  "word-hunt": {
    name: "Word Hunt",
    icon: Trophy,
    instructions: [
      "Busca objetos por la casa diciendo el color en inglés",
      "'Find something blue!' 'Where is something red?'",
      "Cuando encuentre algo, di el nombre en inglés",
      "Celebra cada hallazgo: 'Great job! That's a blue ball!'"
    ],
    duration: "5 min"
  }
};

export function BoscoGameActivity({ open, onOpenChange, onComplete }: BoscoGameActivityProps) {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedGame(null);
      setCurrentStep(0);
      setIsPlaying(false);
      setIsComplete(false);
    }
  }, [open]);

  const handleSelectGame = (game: GameType) => {
    setSelectedGame(game);
    setIsPlaying(true);
    setCurrentStep(0);
  };

  const handleNextStep = () => {
    if (!selectedGame) return;
    const game = GAMES[selectedGame];
    
    if (currentStep < game.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsComplete(true);
      onComplete();
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
  };

  if (isComplete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full mx-auto bg-success/20 flex items-center justify-center">
              <Baby className="w-10 h-10 text-success" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">¡Genial!</h2>
              <p className="text-muted-foreground mt-2">
                Has completado la actividad con Bosco
              </p>
            </div>

            <Button onClick={handleFinish}>
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
            <Baby className="h-5 w-5 text-rose-500" />
            Inglés con Bosco
          </DialogTitle>
        </DialogHeader>

        {!isPlaying ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige un juego para practicar inglés con Bosco (5 minutos sin pantallas)
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(GAMES) as [GameType, typeof GAMES[GameType]][]).map(([key, game]) => {
                const Icon = game.icon;
                return (
                  <Card 
                    key={key}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectGame(key)}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <p className="font-medium">{game.name}</p>
                      <Badge variant="outline" className="text-xs">{game.duration}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : selectedGame && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = GAMES[selectedGame].icon;
                return <Icon className="h-6 w-6 text-primary" />;
              })()}
              <div>
                <h3 className="font-medium">{GAMES[selectedGame].name}</h3>
                <p className="text-sm text-muted-foreground">{GAMES[selectedGame].duration}</p>
              </div>
            </div>

            <div className="space-y-3">
              {GAMES[selectedGame].instructions.map((instruction, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    i === currentStep && "border-primary bg-primary/5",
                    i < currentStep && "border-success/30 bg-success/5",
                    i > currentStep && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sm",
                      i < currentStep ? "bg-success text-success-foreground" : 
                      i === currentStep ? "bg-primary text-primary-foreground" : 
                      "bg-muted text-muted-foreground"
                    )}>
                      {i < currentStep ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <p className={cn(
                      "text-sm",
                      i === currentStep && "font-medium"
                    )}>{instruction}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleNextStep} className="w-full gap-2">
              {currentStep < GAMES[selectedGame].instructions.length - 1 ? (
                <>
                  Siguiente paso <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Completar
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
