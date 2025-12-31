import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Briefcase, Heart, Wallet } from "lucide-react";
import type { Task } from "@/hooks/useTasks";

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
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Top 3 Prioridades
        </CardTitle>
      </CardHeader>
      <CardContent>
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
    </Card>
  );
};
