import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const DraggableCard = ({ id, children, className }: DraggableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 250ms cubic-bezier(0.25, 1, 0.5, 1)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group transition-all duration-200",
        isDragging && "opacity-70 scale-[1.02] z-50 shadow-2xl shadow-primary/20",
        isOver && !isDragging && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-lg",
        className
      )}
    >
      {/* Drag Handle */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -left-3 top-4 opacity-0 group-hover:opacity-100 transition-all duration-200",
          "cursor-grab active:cursor-grabbing p-1.5 rounded-md",
          "bg-background/90 backdrop-blur-sm border border-border/50",
          "hover:bg-primary/10 hover:border-primary/30 hover:scale-110",
          "shadow-sm z-10",
          isDragging && "opacity-100 scale-110 bg-primary/20 border-primary/50"
        )}
      >
        <GripVertical className={cn(
          "w-4 h-4 transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      
      {/* Card Content */}
      <div className={cn(
        "transition-transform duration-200",
        isDragging && "rotate-[1deg]"
      )}>
        {children}
      </div>
    </div>
  );
};
