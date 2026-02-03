import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface BottomNavBarProps {
  onJarvisPress?: () => void;
  isJarvisActive?: boolean;
}

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

  const isDashboardActive = location.pathname === "/dashboard";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-4">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          onClick={handleNavClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1 px-6 py-3 rounded-xl transition-all touch-manipulation",
            isDashboardActive
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground active:bg-accent/50"
          )}
        >
          <LayoutDashboard className={cn("w-6 h-6", isDashboardActive && "scale-110")} />
          <span className="text-xs font-medium">Dashboard</span>
        </NavLink>

        {/* JARVIS - Voice button */}
        <button
          onClick={handleJarvisClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1 px-6 py-3 rounded-xl transition-all touch-manipulation",
            isJarvisActive
              ? "text-destructive"
              : "text-muted-foreground hover:text-foreground active:bg-accent/50"
          )}
        >
          <span className={cn(
            "text-lg font-bold tracking-wide",
            isJarvisActive && "animate-pulse"
          )}>
            JARVIS
          </span>
          <span className={cn(
            "text-[10px] font-medium",
            isJarvisActive ? "text-destructive" : "text-muted-foreground"
          )}>
            {isJarvisActive ? "Activo" : "Voz"}
          </span>
        </button>
      </div>
    </nav>
  );
};
