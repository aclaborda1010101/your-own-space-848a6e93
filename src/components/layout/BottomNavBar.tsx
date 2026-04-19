import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Mic, Settings } from "lucide-react";
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
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const BottomNavBar = ({ onJarvisPress, isJarvisActive = false }: BottomNavBarProps) => {
  const location = useLocation();
  const { selection } = useHaptics();

  const handleNavClick = () => selection();
  const handleJarvisClick = () => {
    selection();
    onJarvisPress?.();
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden safe-bottom"
      aria-label="Navegación principal"
    >
      {/* Glow line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[65%] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative bg-background/85 backdrop-blur-2xl border-t border-border/60 bg-scanlines">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            if (item.isJarvis) {
              return (
                <button
                  key="jarvis"
                  onClick={handleJarvisClick}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
                    isJarvisActive ? "text-destructive" : "text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                      isJarvisActive
                        ? "bg-destructive/20 shadow-[0_0_18px_hsl(var(--destructive)/0.5)]"
                        : "bg-gradient-to-br from-primary via-primary to-primary/70 shadow-[0_0_18px_hsl(var(--primary)/0.6)]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-5 h-5",
                        isJarvisActive ? "animate-pulse" : "text-primary-foreground"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-semibold uppercase tracking-wider mt-1",
                      isJarvisActive ? "text-destructive" : "text-primary"
                    )}
                  >
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
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                )}
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110 drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-mono font-semibold uppercase tracking-wider",
                    isActive && "text-primary"
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
