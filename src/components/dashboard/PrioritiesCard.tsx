import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Target, Briefcase, Heart, Wallet, ChevronDown } from "lucide-react";
import type { Task } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";

interface PrioritiesCardProps {
  priorities: Task[];
  onToggleComplete: (id: string) => void;
}

const priorityColors = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
};

const typeIcons = {
  work: Briefcase,
  life: Heart,
  finance: Wallet,
};

export const PrioritiesCard = ({ priorities, onToggleComplete }: PrioritiesCardProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border bg-card rounded-lg">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-foreground">Top 3 Prioridades</span>
              {priorities.length > 0 && (
                <Badge variant="secondary" className="text-xs">{priorities.length}</Badge>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay tareas pendientes
              </p>
            ) : (
              <div className="space-y-3">
                {priorities.map((priority) => {
                  const TypeIcon = typeIcons[priority.type];
                  return (
                    <div
                      key={priority.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        priority.completed 
                          ? "opacity-50 border-border bg-muted/20" 
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <Checkbox
                        checked={priority.completed}
                        onCheckedChange={() => onToggleComplete(priority.id)}
                        className="mt-0.5 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${priority.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {priority.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-xs ${priorityColors[priority.priority]}`}>
                            {priority.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {priority.duration} min
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
