import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Brain, 
  LayoutDashboard, 
  CheckSquare, 
  BookOpen, 
  Settings,
  X,
  Calendar,
  TrendingUp,
  LogOut,
  Megaphone,
  Target,
  ChevronLeft,
  ChevronRight,
  Sunrise,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { icon: Sunrise, label: "Iniciar Día", path: "/start-day" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Calendar, label: "Calendario", path: "/calendar" },
  { icon: Target, label: "Retos", path: "/challenges" },
  { icon: Sparkles, label: "Noticias IA", path: "/ai-news" },
  { icon: Megaphone, label: "Publicaciones", path: "/publications" },
  { icon: BookOpen, label: "Logs", path: "/logs" },
  { icon: TrendingUp, label: "Análisis", path: "/analytics" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const Sidebar = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn(
          "h-16 flex items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center relative">
                <Brain className="w-5 h-5 text-primary" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">JARVIS</h1>
                <p className="text-xs text-muted-foreground font-mono">v2.0</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center relative">
              <Brain className="w-5 h-5 text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
          )}
          <button 
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collapse Toggle Button - Desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors z-10"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Navigation */}
        <nav className={cn("p-4 space-y-1", isCollapsed && "px-2")}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            const linkContent = (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-all font-medium text-sm",
                  isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                {!isCollapsed && item.label}
              </NavLink>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-sidebar-border",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary font-mono">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email?.split("@")[0] || "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">ACTIVO</p>
              </div>
            </div>
          )}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Cerrar sesión
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-sm"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
