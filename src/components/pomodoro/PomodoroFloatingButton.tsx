import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";
import { PomodoroTimer } from "./PomodoroTimer";
import { cn } from "@/lib/utils";

export const PomodoroFloatingButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-24 z-50 h-12 w-12 rounded-full shadow-lg",
          "bg-warning hover:bg-warning/90 text-warning-foreground"
        )}
        title="Pomodoro Timer"
      >
        <Timer className="h-5 w-5" />
      </Button>

      {isOpen && (
        <PomodoroTimer
          task={null}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
