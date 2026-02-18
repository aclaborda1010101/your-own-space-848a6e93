import { Button } from "@/components/ui/button";
import { Sunrise, Plus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const QuickActions = () => {
  const navigate = useNavigate();

  const handleStartDay = () => {
    navigate("/start-day");
  };

  const handleAddTask = () => {
    navigate("/tasks");
  };

  const handleCalendar = () => {
    navigate("/calendar");
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:flex-row sm:gap-3">
      <Button 
        onClick={handleStartDay}
        className="w-full sm:flex-1 h-12 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 transition-all hover:shadow-lg text-base touch-manipulation"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        <Sunrise className="w-5 h-5" />
        <span className="truncate">Iniciar Día</span>
      </Button>
      
      <Button 
        onClick={handleAddTask}
        variant="outline"
        className="w-full sm:flex-1 h-12 sm:h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2 text-base touch-manipulation"
      >
        <Plus className="w-5 h-5" />
        <span className="truncate">Añadir tarea</span>
      </Button>
      
      <Button 
        onClick={handleCalendar}
        variant="outline"
        className="w-full sm:flex-1 h-12 sm:h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-2 text-base touch-manipulation"
      >
        <RefreshCw className="w-5 h-5" />
        <span className="truncate">Calendario</span>
      </Button>
    </div>
  );
};
