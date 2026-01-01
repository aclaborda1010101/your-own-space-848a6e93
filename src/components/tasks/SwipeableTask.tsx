import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PomodoroButton } from "@/components/pomodoro/PomodoroButton";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useHaptics } from "@/hooks/useHaptics";
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
  const haptics = useHaptics();
  const containerRef = useRef<HTMLDivElement>(null);

  const { handlers, deltaX, isSwiping } = useSwipeGesture({
    threshold: 80,
    onSwipeLeft: () => {
      haptics.warning();
      setIsRevealed("left");
    },
    onSwipeRight: () => {
      haptics.success();
      onToggleComplete(task.id);
      setIsRevealed(null);
    },
  });

  const handleComplete = () => {
    haptics.success();
    onToggleComplete(task.id);
    setIsRevealed(null);
  };

  const handleDelete = () => {
    haptics.error();
    onDelete(task.id);
    setIsRevealed(null);
  };

  const handleCancel = () => {
    haptics.lightTap();
    setIsRevealed(null);
  };

  const TypeIcon = typeConfig[task.type].icon;

  // Calculate transform based on swipe
  const getTransform = () => {
    if (isRevealed === "left") return "translateX(-100px)";
    if (isRevealed === "right") return "translateX(100px)";
    if (isSwiping) return `translateX(${deltaX}px)`;
    return "translateX(0)";
  };

  // Calculate background reveal color
  const getBackgroundColor = () => {
    if (deltaX > 30) return "bg-success";
    if (deltaX < -30) return "bg-destructive";
    return "bg-muted";
  };

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-lg"
    >
      {/* Background Actions */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-between px-4 transition-colors",
        getBackgroundColor()
      )}>
        {/* Right swipe - Complete */}
        <div className="flex items-center gap-2 text-white">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">Completar</span>
        </div>
        
        {/* Left swipe - Delete */}
        <div className="flex items-center gap-2 text-white">
          <span className="text-sm font-medium">Eliminar</span>
          <Trash2 className="w-5 h-5" />
        </div>
      </div>

      {/* Task Content */}
      <div
        {...handlers}
        className={cn(
          "relative bg-card border border-border p-3 transition-transform duration-200",
          isSwiping && "transition-none"
        )}
        style={{ transform: getTransform() }}
      >
        {/* Revealed Action Buttons */}
        {isRevealed === "left" && (
          <div className="absolute right-0 top-0 bottom-0 w-[100px] flex items-center justify-center gap-2 bg-destructive/10 px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-10 w-10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-10 w-10 text-muted-foreground hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleComplete()}
            className="mt-1 border-primary data-[state=checked]:bg-primary"
          />
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-foreground",
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-xs ${typeConfig[task.type].color}`}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {typeConfig[task.type].label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
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
                    onConvertToBlock(task.title, task.duration);
                  }}
                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Calendar className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Swipe hint on mobile */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 md:hidden">
          ← Desliza para acciones →
        </div>
      </div>
    </div>
  );
};

export default SwipeableTask;
