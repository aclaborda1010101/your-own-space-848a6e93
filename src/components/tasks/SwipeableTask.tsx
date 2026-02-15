import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PomodoroButton } from "@/components/pomodoro/PomodoroButton";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  Mic,
  Mail,
  MessageCircle,
  CalendarIcon,
  FileText,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2" | "P3";
  duration: number;
  completed: boolean;
  dueDate?: Date | null;
  source?: string;
  description?: string | null;
}

interface SwipeableTaskProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onConvertToBlock?: (title: string, duration: number) => void;
  onUpdateTask?: (id: string, updates: { due_date?: string | null }) => void;
}

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/10 text-primary border-primary/20" },
  life: { icon: Heart, label: "Vida", color: "bg-success/10 text-success border-success/20" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/10 text-warning border-warning/20" },
};

const priorityColors: Record<string, string> = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
  P3: "bg-secondary/50 text-secondary-foreground border-border/50",
};

const sourceConfig: Record<string, { icon: typeof Mic; label: string; color: string }> = {
  plaud: { icon: Mic, label: "Plaud", color: "bg-accent/20 text-accent-foreground border-accent/30" },
  email: { icon: Mail, label: "Email", color: "bg-primary/10 text-primary border-primary/20" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "bg-success/10 text-success border-success/20" },
  manual: { icon: FileText, label: "Manual", color: "bg-muted text-muted-foreground border-border" },
};

export const SwipeableTask = ({ 
  task, 
  onToggleComplete, 
  onDelete,
  onConvertToBlock,
  onUpdateTask,
}: SwipeableTaskProps) => {
  const [isRevealed, setIsRevealed] = useState<"left" | "right" | null>(null);
  const [isExiting, setIsExiting] = useState<"complete" | "delete" | null>(null);
  const [isOpen, setIsOpen] = useState(false);
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

  const handleDateChange = (date: Date | undefined) => {
    if (!onUpdateTask) return;
    const dueDateStr = date ? date.toISOString().split("T")[0] : null;
    onUpdateTask(task.id, { due_date: dueDateStr });
  };

  const TypeIcon = typeConfig[task.type].icon;
  const source = sourceConfig[task.source || "manual"] || sourceConfig.manual;
  const SourceIcon = source.icon;
  const hasExpandableContent = task.source !== "manual" || task.description;

  const getTransform = () => {
    if (isExiting === "complete") return "translateX(100%)";
    if (isExiting === "delete") return "translateX(-100%)";
    if (isRevealed === "left") return "translateX(-100px)";
    if (isRevealed === "right") return "translateX(100px)";
    if (isSwiping) return `translateX(${deltaX}px)`;
    return "translateX(0)";
  };

  const getBackgroundColor = () => {
    if (isExiting === "complete") return "bg-success";
    if (isExiting === "delete") return "bg-destructive";
    if (deltaX > 30) return "bg-success";
    if (deltaX < -30) return "bg-destructive";
    return "bg-muted";
  };

  const getExitClasses = () => {
    if (isExiting === "complete" || isExiting === "delete") {
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
        maxHeight: isExiting ? 0 : 500,
        marginBottom: isExiting ? 0 : undefined,
      }}
    >
      {/* Background Actions */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-between px-4 transition-colors duration-200",
        getBackgroundColor()
      )}>
        <div className={cn(
          "flex items-center gap-2 text-white transition-all duration-200",
          deltaX > 30 ? "scale-110" : "scale-100"
        )}>
          <Check className={cn("w-5 h-5 transition-transform duration-200", deltaX > 60 && "scale-125")} />
          <span className="text-sm font-medium">Completar</span>
        </div>
        <div className={cn(
          "flex items-center gap-2 text-white transition-all duration-200",
          deltaX < -30 ? "scale-110" : "scale-100"
        )}>
          <span className="text-sm font-medium">Eliminar</span>
          <Trash2 className={cn("w-5 h-5 transition-transform duration-200", deltaX < -60 && "scale-125")} />
        </div>
      </div>

      {/* Task Content */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
              <Button variant="ghost" size="icon" onClick={handleDelete}
                className="h-10 w-10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-110">
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancel}
                className="h-10 w-10 text-muted-foreground hover:bg-muted transition-all duration-200">
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
              <CollapsibleTrigger asChild disabled={!hasExpandableContent}>
                <div className={cn("cursor-default", hasExpandableContent && "cursor-pointer")}>
                  <div className="flex items-center gap-1.5">
                    <p className={cn(
                      "font-medium text-foreground transition-all duration-200 flex-1",
                      task.completed && "line-through text-muted-foreground"
                    )}>
                      {task.title}
                    </p>
                    {hasExpandableContent && (
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                        isOpen && "rotate-180"
                      )} />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className={cn("text-xs transition-all duration-200", typeConfig[task.type].color)}>
                  <TypeIcon className="w-3 h-3 mr-1" />
                  {typeConfig[task.type].label}
                </Badge>
                <Badge variant="outline" className={cn("text-xs transition-all duration-200", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
                <Badge variant="outline" className="text-xs border-border text-muted-foreground transition-all duration-200">
                  <Clock className="w-3 h-3 mr-1" />
                  {task.duration} min
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground transition-all duration-200">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(task.dueDate, "dd/MM")}
                  </Badge>
                )}
                {task.source && task.source !== "manual" && (
                  <Badge variant="outline" className={cn("text-xs transition-all duration-200", source.color)}>
                    <SourceIcon className="w-3 h-3 mr-1" />
                    {source.label}
                  </Badge>
                )}
              </div>
            </div>

            {!task.completed && (
              <div className="flex gap-1 items-center">
                <PomodoroButton
                  task={{ id: task.id, title: task.title, duration: task.duration }}
                  onComplete={onToggleComplete}
                  variant="button"
                  className="text-xs"
                />
                {onConvertToBlock && (
                  <Button variant="ghost" size="icon"
                    onClick={() => {
                      haptics.lightTap();
                      sounds.tap();
                      onConvertToBlock(task.title, task.duration);
                    }}
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 hover:scale-110">
                    <Calendar className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Expandable Detail */}
          <CollapsibleContent className="mt-3 pt-3 border-t border-border/50 space-y-3">
            {task.description && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <p className="leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Editable due date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">FECHA ENTREGA:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 rounded-lg gap-1.5 text-xs",
                      task.dueDate ? "border-primary/30 text-primary" : "border-border/50 text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {task.dueDate ? format(task.dueDate, "dd/MM/yyyy") : "Sin fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={task.dueDate || undefined}
                    onSelect={handleDateChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {task.dueDate && onUpdateTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateTask(task.id, { due_date: null })}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3 mr-1" />
                  Quitar
                </Button>
              )}
            </div>
          </CollapsibleContent>

          {/* Swipe hint on mobile */}
          <div className={cn(
            "absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 md:hidden",
            "transition-opacity duration-200",
            isSwiping && "opacity-0"
          )}>
            ← Desliza para acciones →
          </div>
        </div>
      </Collapsible>
    </div>
  );
};

export default SwipeableTask;
