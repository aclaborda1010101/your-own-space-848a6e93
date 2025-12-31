import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minimize2, Square, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardSize } from "@/hooks/useDashboardLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  size?: CardSize;
  onSizeChange?: (size: CardSize) => void;
}

const sizeLabels: Record<CardSize, { label: string; icon: typeof Square }> = {
  compact: { label: "Compacto", icon: Minimize2 },
  normal: { label: "Normal", icon: Square },
  large: { label: "Grande", icon: Maximize2 },
};

export const DraggableCard = ({ 
  id, 
  children, 
  className, 
  size = "normal",
  onSizeChange,
}: DraggableCardProps) => {
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

  const sizeClasses: Record<CardSize, string> = {
    compact: "[&_.card-content]:max-h-[150px] [&_.card-content]:overflow-hidden",
    normal: "",
    large: "[&_.card-content]:min-h-[300px]",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group transition-all duration-200",
        sizeClasses[size],
        isDragging && "opacity-70 scale-[1.02] z-50 shadow-2xl shadow-primary/20",
        isOver && !isDragging && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-lg",
        className
      )}
    >
      {/* Controls */}
      <div className={cn(
        "absolute -left-3 top-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10",
        isDragging && "opacity-100"
      )}>
        {/* Drag Handle */}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1.5 rounded-md",
            "bg-background/90 backdrop-blur-sm border border-border/50",
            "hover:bg-primary/10 hover:border-primary/30 hover:scale-110",
            "shadow-sm transition-all duration-200",
            isDragging && "scale-110 bg-primary/20 border-primary/50"
          )}
        >
          <GripVertical className={cn(
            "w-4 h-4 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
        </div>

        {/* Size Control */}
        {onSizeChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 p-0",
                  "bg-background/90 backdrop-blur-sm border border-border/50",
                  "hover:bg-primary/10 hover:border-primary/30",
                  "shadow-sm"
                )}
              >
                {size === "compact" && <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />}
                {size === "normal" && <Square className="w-3.5 h-3.5 text-muted-foreground" />}
                {size === "large" && <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuLabel className="text-xs">Tamaño</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(sizeLabels) as CardSize[]).map((s) => {
                const Icon = sizeLabels[s].icon;
                return (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => onSizeChange(s)}
                    className={cn(size === s && "bg-primary/10")}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {sizeLabels[s].label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
