import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

const navItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/dashboard" },
  { icon: MessageSquare, label: "JARVIS", path: "/chat" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const BottomNavBar = () => {
  const location = useLocation();
  const { selection } = useHaptics();

  const handleNavClick = () => {
    selection();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-18 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 px-8 py-3 rounded-xl transition-all min-w-[90px] relative touch-manipulation",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground active:bg-accent/50"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "scale-110")} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
