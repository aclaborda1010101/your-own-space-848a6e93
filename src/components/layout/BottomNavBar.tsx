import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Mic, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface BottomNavBarProps {
  onJarvisPress?: () => void;
  isJarvisActive?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Mic, label: "JARVIS", path: null, isJarvis: true },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const BottomNavBar = ({ onJarvisPress, isJarvisActive = false }: BottomNavBarProps) => {
  const location = useLocation();
  const { selection } = useHaptics();

  const handleNavClick = () => {
    selection();
  };

  const handleJarvisClick = () => {
    selection();
    onJarvisPress?.();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          if (item.isJarvis) {
            return (
              <button
                key="jarvis"
                onClick={handleJarvisClick}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
                  isJarvisActive
                    ? "text-destructive"
                    : "text-muted-foreground hover:text-foreground active:bg-accent/50"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full",
                  isJarvisActive ? "bg-destructive/20" : "bg-primary/10"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5",
                    isJarvisActive && "animate-pulse"
                  )} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold",
                  isJarvisActive && "text-destructive"
                )}>
                  {item.label}
                </span>
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
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
                isActive
                  ? "text-primary"
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
