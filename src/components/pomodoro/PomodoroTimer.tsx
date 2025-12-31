import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Timer,
  Coffee,
  Briefcase,
  SkipForward
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useUserSettings } from "@/hooks/useUserSettings";
import { PomodoroSettingsDialog } from "@/components/settings/PomodoroSettingsDialog";

interface PomodoroTimerProps {
  task?: {
    id: string;
    title: string;
    duration: number;
  } | null;
  onClose: () => void;
  onComplete?: (taskId: string) => void;
}

type SessionType = "work" | "shortBreak" | "longBreak";

const SESSION_LABELS = {
  work: "Trabajo",
  shortBreak: "Descanso corto",
  longBreak: "Descanso largo",
};

export const PomodoroTimer = ({ task, onClose, onComplete }: PomodoroTimerProps) => {
  const { settings } = useUserSettings();
  const { saveSession } = usePomodoro();
  
  const sessionDurations = useMemo(() => ({
    work: settings.pomodoro_work_duration * 60,
    shortBreak: settings.pomodoro_short_break * 60,
    longBreak: settings.pomodoro_long_break * 60,
  }), [settings]);

  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [timeLeft, setTimeLeft] = useState(sessionDurations.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalWorkTime, setTotalWorkTime] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update timeLeft when settings change and timer is not running
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(sessionDurations[sessionType]);
    }
  }, [sessionDurations, sessionType, isRunning]);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAKl9PQqpI8AAw2irHY0qlaHgxNsdHQpnYsCE2v0dKnfD8ATLDQ06mDTQBGr9DTqYRVAD2v0NOphlsANK/P06mGYAAsr87TqYZlACWvzdOphmoAHq/N06mGbgAYrs3TqYZyABKuzdOph3YADa3M06mHegAIrczTqYh9AAOty9OpiIEA/6zL06mIhAD7rMvTqYiHAPesy9OpiYoA86vL06mJjQDvq8vTqYmPAOury9Opi5IA6KrK06mLlQDkqsrTqYuXAOGqytOpi5oA3arK06mLnADaqsrTqYufANeqytOpi6EA1KrK06mMowDRqsrTqYylAM6pydOqjKgAy6nJ06qMqgDJqcnTqoysAMepydOqjK4AxKnJ06qMsADCqcnTqoyyAMCpydOqjLQAvqnJ06qNtgC8qcnTqo24ALqpydOqjboAuKjJ06qNvAC2qMnTqo2+ALWoydOqjcAAc6jJ06qOwgBxqMnTqo7EAHCnydOqjsYAbqfJ06qOyABsp8nTqo7KAGunyNOqjs0AaafI06qOzwBnp8jTqo/RAGWnyNOqj9MAZKfI06qP1QBip8jTqo/XAGGnx9Oqj9kAX6fH06qP2wBep8fTqo/dAFynx9OqkN8AW6fH06qQ4QBZp8fTqpDjAFimx9OqkOUAV6bH06qQ5wBWpsfTqpDpAFSmx9OqkesAU6bG06qR7QBSpsb");
  }, []);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
        
        if (sessionType === "work") {
          setTotalWorkTime((prev) => prev + 1);
        }
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, sessionType]);

  const handleSessionComplete = useCallback(() => {
    setIsRunning(false);
    
    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

    if (sessionType === "work") {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      
      // Save completed work session to database
      saveSession(
        task?.id || null,
        task?.title || null,
        settings.pomodoro_work_duration,
        "work"
      );
      
      toast.success(`¡Pomodoro #${newCount} completado!`, {
        description: task ? `Tarea: ${task.title}` : undefined,
      });
      
      // Every 4 pomodoros, take a long break
      if (newCount % 4 === 0) {
        setSessionType("longBreak");
        setTimeLeft(sessionDurations.longBreak);
        toast.info("¡Hora de un descanso largo!");
      } else {
        setSessionType("shortBreak");
        setTimeLeft(sessionDurations.shortBreak);
        toast.info("¡Hora de un descanso corto!");
      }
    } else {
      setSessionType("work");
      setTimeLeft(sessionDurations.work);
      toast.info("¡De vuelta al trabajo!");
    }
  }, [sessionType, completedPomodoros, task, saveSession, settings, sessionDurations]);

  const toggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(sessionDurations[sessionType]);
  };

  const skipSession = () => {
    setIsRunning(false);
    if (sessionType === "work") {
      setSessionType("shortBreak");
      setTimeLeft(sessionDurations.shortBreak);
    } else {
      setSessionType("work");
      setTimeLeft(sessionDurations.work);
    }
  };

  const switchSession = (type: SessionType) => {
    setIsRunning(false);
    setSessionType(type);
    setTimeLeft(sessionDurations[type]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((sessionDurations[sessionType] - timeLeft) / sessionDurations[sessionType]) * 100;

  const handleMarkComplete = () => {
    if (task && onComplete) {
      onComplete(task.id);
      toast.success(`Tarea completada: ${task.title}`);
    }
  };

  return (
    <Card className={cn(
      "fixed bottom-24 right-6 z-40 w-80 shadow-xl border-2 transition-colors",
      sessionType === "work" 
        ? "border-primary/50 bg-card" 
        : "border-success/50 bg-success/5"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {sessionType === "work" ? (
              <Briefcase className="w-4 h-4 text-primary" />
            ) : (
              <Coffee className="w-4 h-4 text-success" />
            )}
            <span className="font-medium text-sm">
              {SESSION_LABELS[sessionType]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PomodoroSettingsDialog />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Task info */}
        {task && (
          <div className="mb-4 p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Trabajando en:</p>
            <p className="text-sm font-medium truncate">{task.title}</p>
          </div>
        )}

        {/* Session tabs */}
        <div className="flex gap-1 mb-4">
          {(["work", "shortBreak", "longBreak"] as SessionType[]).map((type) => (
            <button
              key={type}
              onClick={() => switchSession(type)}
              className={cn(
                "flex-1 py-1.5 px-2 text-xs rounded-md transition-colors",
                sessionType === type
                  ? type === "work"
                    ? "bg-primary text-primary-foreground"
                    : "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {type === "work" ? "Trabajo" : type === "shortBreak" ? "Corto" : "Largo"}
            </button>
          ))}
        </div>

        {/* Timer display */}
        <div className="text-center mb-4">
          <div className={cn(
            "text-5xl font-bold font-mono",
            sessionType === "work" ? "text-primary" : "text-success"
          )}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <Progress 
          value={progress} 
          className={cn(
            "h-2 mb-4",
            sessionType !== "work" && "[&>div]:bg-success"
          )} 
        />

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={resetTimer}
            className="h-10 w-10"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button
            size="lg"
            onClick={toggleTimer}
            className={cn(
              "h-12 w-12 rounded-full",
              sessionType !== "work" && "bg-success hover:bg-success/90"
            )}
          >
            {isRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={skipSession}
            className="h-10 w-10"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            <span>Pomodoros: {completedPomodoros}</span>
          </div>
          <div>
            Tiempo total: {Math.floor(totalWorkTime / 60)}m
          </div>
        </div>

        {/* Mark task complete button */}
        {task && onComplete && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={handleMarkComplete}
          >
            Marcar tarea como completada
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
