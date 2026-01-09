import { Button } from "@/components/ui/button";
import { Sparkles, Plus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const QuickActions = () => {
  const navigate = useNavigate();

  const handlePlanDay = () => {
    toast.success("Planificando tu día...", {
      description: "JARVIS está optimizando tu agenda basándose en tu check-in.",
    });
  };

  const handleAddTask = () => {
    navigate("/tasks");
  };

  const handleReplan = () => {
    toast.info("Replanificando...", {
      description: "Ajustando bloques según los cambios detectados.",
    });
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:flex-row sm:gap-3">
      <Button 
        onClick={handlePlanDay}
        className="w-full sm:flex-1 h-11 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 transition-all hover:shadow-lg text-sm sm:text-base"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="truncate">Planifícame el día</span>
      </Button>
      
      <Button 
        onClick={handleAddTask}
        variant="outline"
        className="w-full sm:flex-1 h-11 sm:h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2 text-sm sm:text-base"
      >
        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="truncate">Añadir tarea</span>
      </Button>
      
      <Button 
        onClick={handleReplan}
        variant="outline"
        className="w-full sm:flex-1 h-11 sm:h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2 text-sm sm:text-base"
      >
        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="truncate">Replanificar</span>
      </Button>
    </div>
  );
};
