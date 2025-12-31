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
    <div className="flex flex-col sm:flex-row gap-3">
      <Button 
        onClick={handlePlanDay}
        className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 transition-all hover:shadow-lg"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        <Sparkles className="w-5 h-5" />
        Planifícame el día
      </Button>
      
      <Button 
        onClick={handleAddTask}
        variant="outline"
        className="flex-1 h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2"
      >
        <Plus className="w-5 h-5" />
        Añadir tarea
      </Button>
      
      <Button 
        onClick={handleReplan}
        variant="outline"
        className="flex-1 h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2"
      >
        <RefreshCw className="w-5 h-5" />
        Replanificar
      </Button>
    </div>
  );
};
