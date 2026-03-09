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
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
      {actions.map(({ icon: Icon, label, path, primary }) => (
        <Button
          key={path}
          onClick={() => navigate(path)}
          variant={primary ? "default" : "outline"}
          className={cn(
            "h-10 gap-2 text-sm font-medium shrink-0 transition-all touch-manipulation",
            primary
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
              : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
};
