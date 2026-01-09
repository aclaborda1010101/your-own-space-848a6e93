import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Calendar, Menu, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavBarProps {
  onMenuClick: () => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/dashboard" },
  { icon: Sunrise, label: "Día", path: "/start-day" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Calendar, label: "Agenda", path: "/calendar" },
];

export const BottomNavBar = ({ onMenuClick }: BottomNavBarProps) => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
        
        {/* Menu button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] text-muted-foreground hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
};
