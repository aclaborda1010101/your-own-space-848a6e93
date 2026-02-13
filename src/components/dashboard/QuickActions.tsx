import { Button } from "@/components/ui/button";
import { Sunrise, Plus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-2 w-full sm:flex-row sm:gap-2">
      <Button 
        onClick={() => navigate("/start-day")}
        className="w-full sm:flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 transition-all rounded-xl text-sm touch-manipulation"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        <Sunrise className="w-4 h-4" />
        <span className="truncate">Iniciar Día</span>
      </Button>
      
      <Button 
        onClick={() => navigate("/tasks")}
        variant="outline"
        className="w-full sm:flex-1 h-10 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-foreground font-medium gap-2 text-sm rounded-xl touch-manipulation"
      >
        <Plus className="w-4 h-4" />
        <span className="truncate">Añadir tarea</span>
      </Button>
      
      <Button 
        onClick={() => navigate("/calendar")}
        variant="outline"
        className="w-full sm:flex-1 h-10 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-foreground font-medium gap-2 text-sm rounded-xl touch-manipulation"
      >
        <RefreshCw className="w-4 h-4" />
        <span className="truncate">Calendario</span>
      </Button>
    </div>
  );
};
