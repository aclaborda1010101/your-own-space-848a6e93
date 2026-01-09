import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Calendar, Menu, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface BottomNavBarProps {
  onMenuClick: () => void;
  pendingTasksCount?: number;
  notificationsCount?: number;
}

const navItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/dashboard", badgeKey: "notifications" as const },
  { icon: Sunrise, label: "Día", path: "/start-day", badgeKey: null },
  { icon: CheckSquare, label: "Tareas", path: "/tasks", badgeKey: "tasks" as const },
  { icon: Calendar, label: "Agenda", path: "/calendar", badgeKey: null },
];

export const BottomNavBar = ({ onMenuClick, pendingTasksCount = 0, notificationsCount = 0 }: BottomNavBarProps) => {
  const location = useLocation();
  const { selection } = useHaptics();

  const getBadgeCount = (badgeKey: "notifications" | "tasks" | null) => {
    if (badgeKey === "notifications") return notificationsCount;
    if (badgeKey === "tasks") return pendingTasksCount;
    return 0;
  };

  const handleNavClick = () => {
    selection();
  };

  const handleMenuClick = () => {
    selection();
    onMenuClick();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badgeKey);
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] relative",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
        
        {/* Menu button */}
        <button
          onClick={handleMenuClick}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] text-muted-foreground hover:text-foreground active:scale-95"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
};
