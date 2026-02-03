import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, MessageSquare, Settings, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface BottomNavBarProps {
  onPotusPress?: () => void;
  isPotusActive?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/dashboard" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Mic, label: "POTUS", path: null, isPotus: true },
  { icon: MessageSquare, label: "Chat", path: "/communications" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const BottomNavBar = ({ onPotusPress, isPotusActive = false }: BottomNavBarProps) => {
  const location = useLocation();
  const { selection } = useHaptics();

  const handleNavClick = () => {
    selection();
  };

  const handlePotusClick = () => {
    selection();
    onPotusPress?.();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-18 px-2">
        {navItems.map((item) => {
          if (item.isPotus) {
            return (
              <button
                key="potus"
                onClick={handlePotusClick}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all min-w-[70px] relative touch-manipulation",
                  isPotusActive
                    ? "text-destructive"
                    : "text-primary hover:text-primary/80 active:bg-accent/50"
                )}
              >
                <div className={cn(
                  "relative w-10 h-10 rounded-full flex items-center justify-center",
                  isPotusActive 
                    ? "bg-destructive/20" 
                    : "bg-primary/10"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5",
                    isPotusActive && "animate-pulse"
                  )} />
                  {isPotusActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path!}
              onClick={handleNavClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all min-w-[70px] relative touch-manipulation",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground active:bg-accent/50"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
