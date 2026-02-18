import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";
import { PomodoroTimer } from "./PomodoroTimer";
import { cn } from "@/lib/utils";

interface PomodoroButtonProps {
  task?: {
    id: string;
    title: string;
    duration: number;
  } | null;
  onComplete?: (taskId: string) => void;
  variant?: "icon" | "button";
  className?: string;
}

export const PomodoroButton = ({ 
  task, 
  onComplete, 
  variant = "icon",
  className 
}: PomodoroButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className={cn("h-8 w-8", className)}
          title="Iniciar Pomodoro"
        >
          <Timer className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={cn("gap-1.5", className)}
        >
          <Timer className="h-3.5 w-3.5" />
          Enfoque
        </Button>
      )}

      {isOpen && (
        <PomodoroTimer
          task={task}
          onClose={() => setIsOpen(false)}
          onComplete={onComplete}
        />
      )}
    </>
  );
};
