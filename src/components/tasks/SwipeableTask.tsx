import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PomodoroButton } from "@/components/pomodoro/PomodoroButton";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useHaptics } from "@/hooks/useHaptics";
import { useSoundFeedback } from "@/hooks/useSoundFeedback";
import { cn } from "@/lib/utils";
import { 
  Clock, 
  Calendar, 
  Trash2,
  Briefcase,
  Heart,
  Wallet,
  Check,
  X,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
  completed: boolean;
}

interface SwipeableTaskProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onConvertToBlock?: (title: string, duration: number) => void;
}

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/10 text-primary border-primary/20" },
  life: { icon: Heart, label: "Vida", color: "bg-success/10 text-success border-success/20" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/10 text-warning border-warning/20" },
};

const priorityColors = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
};

export const SwipeableTask = ({ 
  task, 
  onToggleComplete, 
  onDelete,
  onConvertToBlock,
}: SwipeableTaskProps) => {
  const [isRevealed, setIsRevealed] = useState<"left" | "right" | null>(null);
  const [isExiting, setIsExiting] = useState<"complete" | "delete" | null>(null);
  const haptics = useHaptics();
  const sounds = useSoundFeedback();
  const containerRef = useRef<HTMLDivElement>(null);

  const { handlers, deltaX, isSwiping } = useSwipeGesture({
    threshold: 80,
    onSwipeLeft: () => {
      haptics.warning();
      sounds.warning();
      setIsRevealed("left");
    },
    onSwipeRight: () => {
      handleComplete();
    },
  });

  const handleComplete = () => {
    haptics.success();
    sounds.complete();
    setIsExiting("complete");
    // Wait for animation to complete before actually toggling
    setTimeout(() => {
      onToggleComplete(task.id);
      setIsRevealed(null);
      setIsExiting(null);
    }, 300);
  };

  const handleDelete = () => {
    haptics.error();
    sounds.delete();
    setIsExiting("delete");
    // Wait for animation to complete before actually deleting
    setTimeout(() => {
      onDelete(task.id);
      setIsRevealed(null);
      setIsExiting(null);
    }, 300);
  };

  const handleCancel = () => {
    haptics.lightTap();
    sounds.tap();
    setIsRevealed(null);
  };

  const TypeIcon = typeConfig[task.type].icon;

  // Calculate transform based on swipe
  const getTransform = () => {
    if (isExiting === "complete") return "translateX(100%)";
    if (isExiting === "delete") return "translateX(-100%)";
    if (isRevealed === "left") return "translateX(-100px)";
    if (isRevealed === "right") return "translateX(100px)";
    if (isSwiping) return `translateX(${deltaX}px)`;
    return "translateX(0)";
  };

  // Calculate background reveal color with smooth transition
  const getBackgroundColor = () => {
    if (isExiting === "complete") return "bg-success";
    if (isExiting === "delete") return "bg-destructive";
    if (deltaX > 30) return "bg-success";
    if (deltaX < -30) return "bg-destructive";
    return "bg-muted";
  };

  // Get exit animation classes
  const getExitClasses = () => {
    if (isExiting === "complete") {
      return "opacity-0 scale-95 h-0 mb-0 overflow-hidden";
    }
    if (isExiting === "delete") {
      return "opacity-0 scale-95 h-0 mb-0 overflow-hidden";
    }
    return "";
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg transition-all duration-300 ease-out",
        getExitClasses()
      )}
      style={{
        maxHeight: isExiting ? 0 : 200,
        marginBottom: isExiting ? 0 : undefined,
      }}
    >
      {/* Background Actions */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-between px-4 transition-colors duration-200",
        getBackgroundColor()
      )}>
        {/* Right swipe - Complete */}
        <div className={cn(
          "flex items-center gap-2 text-white transition-all duration-200",
          deltaX > 30 ? "scale-110" : "scale-100"
        )}>
          <Check className={cn(
            "w-5 h-5 transition-transform duration-200",
            deltaX > 60 && "scale-125"
          )} />
          <span className="text-sm font-medium">Completar</span>
        </div>
        
        {/* Left swipe - Delete */}
        <div className={cn(
          "flex items-center gap-2 text-white transition-all duration-200",
          deltaX < -30 ? "scale-110" : "scale-100"
        )}>
          <span className="text-sm font-medium">Eliminar</span>
          <Trash2 className={cn(
            "w-5 h-5 transition-transform duration-200",
            deltaX < -60 && "scale-125"
          )} />
        </div>
      </div>

      {/* Task Content */}
      <div
        {...handlers}
        className={cn(
          "relative bg-card border border-border p-3 rounded-lg",
          "transition-all duration-300 ease-out",
          isSwiping && "transition-none",
          isExiting && "transition-transform duration-300 ease-out"
        )}
        style={{ transform: getTransform() }}
      >
        {/* Revealed Action Buttons */}
        {isRevealed === "left" && !isExiting && (
          <div className="absolute right-0 top-0 bottom-0 w-[100px] flex items-center justify-center gap-2 bg-destructive/10 px-2 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-10 w-10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-110"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-10 w-10 text-muted-foreground hover:bg-muted transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleComplete()}
            className={cn(
              "mt-1 border-primary data-[state=checked]:bg-primary",
              "transition-transform duration-200 hover:scale-110"
            )}
          />
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-foreground transition-all duration-200",
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={cn(
                "text-xs transition-all duration-200",
                typeConfig[task.type].color
              )}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {typeConfig[task.type].label}
              </Badge>
              <Badge variant="outline" className={cn(
                "text-xs transition-all duration-200",
                priorityColors[task.priority]
              )}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className="text-xs border-border text-muted-foreground transition-all duration-200">
                <Clock className="w-3 h-3 mr-1" />
                {task.duration} min
              </Badge>
            </div>
          </div>

          {!task.completed && (
            <div className="flex gap-1 items-center">
              <PomodoroButton
                task={{
                  id: task.id,
                  title: task.title,
                  duration: task.duration,
                }}
                onComplete={onToggleComplete}
                variant="button"
                className="text-xs"
              />
              {onConvertToBlock && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    haptics.lightTap();
                    sounds.tap();
                    onConvertToBlock(task.title, task.duration);
                  }}
                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 hover:scale-110"
                >
                  <Calendar className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Swipe hint on mobile */}
        <div className={cn(
          "absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 md:hidden",
          "transition-opacity duration-200",
          isSwiping && "opacity-0"
        )}>
          ← Desliza para acciones →
        </div>
      </div>
    </div>
  );
};

export default SwipeableTask;
