import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CheckSquare,
  Sparkles,
  Activity,
  Menu as MenuIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface BottomNavBarProps {
  onJarvisPress?: () => void;
  isJarvisActive?: boolean;
}

const primary = [
  { icon: CalendarCheck, label: "Hoy", path: "/dashboard" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Activity, label: "Salud", path: "/health" },
];

export const BottomNavBar = ({ onJarvisPress, isJarvisActive = false }: BottomNavBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selection } = useHaptics();

  const tap = () => selection();

  const handleJarvis = () => {
    selection();
    if (onJarvisPress) onJarvisPress();
    else window.dispatchEvent(new CustomEvent('jarvis:toggle'));
  };

  const isMenuActive = location.pathname === "/menu";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      aria-label="Navegación principal"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[65%] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Background extiende hasta el borde físico inferior; padding interno respeta el home indicator */}
      <div className="relative bg-background/95 backdrop-blur-2xl border-t border-border/60 bg-scanlines pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end justify-around h-16 px-1">
          <NavItem item={primary[0]} active={location.pathname === primary[0].path} onClick={tap} />
          <NavItem item={primary[1]} active={location.pathname === primary[1].path} onClick={tap} />

          {/* JARVIS centro */}
          <button
            onClick={handleJarvis}
            className="relative flex flex-col items-center justify-end pb-1 -mt-6 touch-manipulation"
            aria-label="JARVIS"
          >
            <div
              className={cn(
                "flex items-center justify-center w-14 h-14 rounded-full transition-all border-2",
                isJarvisActive
                  ? "bg-destructive/20 border-destructive shadow-[0_0_24px_hsl(var(--destructive)/0.6)]"
                  : "bg-gradient-to-br from-primary via-primary to-primary/70 border-primary/40 shadow-[0_0_24px_hsl(var(--primary)/0.7)]",
              )}
            >
              <Sparkles
                className={cn(
                  "w-6 h-6",
                  isJarvisActive ? "animate-pulse text-destructive" : "text-primary-foreground",
                )}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-mono font-semibold uppercase tracking-wider mt-0.5",
                isJarvisActive ? "text-destructive" : "text-primary",
              )}
            >
              JARVIS
            </span>
          </button>

          <NavItem item={primary[2]} active={location.pathname === primary[2].path} onClick={tap} />

          {/* Menú → /menu */}
          <button
            onClick={() => {
              selection();
              navigate("/menu");
            }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
              isMenuActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Abrir menú"
          >
            {isMenuActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            )}
            <MenuIcon className={cn("w-5 h-5", isMenuActive && "scale-110 drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
              Menú
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { icon: any; label: string; path: string };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
      )}
      <Icon
        className={cn(
          "w-5 h-5 transition-transform",
          active && "scale-110 drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-mono font-semibold uppercase tracking-wider",
          active && "text-primary",
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}
