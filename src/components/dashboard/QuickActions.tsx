import { Button } from "@/components/ui/button";
import { Sunrise, Plus, Calendar, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const actions = [
  { icon: Sunrise, label: "Iniciar Día", path: "/start-day", primary: true },
  { icon: Plus, label: "Nueva tarea", path: "/tasks", primary: false },
  { icon: Calendar, label: "Calendario", path: "/calendar", primary: false },
  { icon: MessageSquare, label: "JARVIS", path: "/chat", primary: false },
];

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:overflow-x-auto sm:scrollbar-none pb-0.5">
      {actions.map(({ icon: Icon, label, path, primary }) => (
        <Button
          key={path}
          onClick={() => navigate(path)}
          variant={primary ? "default" : "outline"}
          className={cn(
            "h-11 gap-2 text-sm font-medium w-full sm:w-auto sm:shrink-0 transition-all touch-manipulation",
            primary
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 col-span-2 sm:col-span-1"
              : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </Button>
      ))}
    </div>
  );
};
