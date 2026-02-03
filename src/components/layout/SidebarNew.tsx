import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Brain, 
  LayoutDashboard, 
  MessageSquare, 
  Mail, 
  Activity,
  Trophy,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarNewProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Menú simplificado según el MEGAPROMPT
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, label: "JARVIS", path: "/chat" },
  { icon: Mail, label: "Comunicaciones", path: "/communications" },
  { icon: Activity, label: "Salud", path: "/health" },
  { icon: Trophy, label: "Deportes", path: "/sports" },
];

const systemItems = [
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const SidebarNew = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarNewProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const renderNavLink = (item: { icon: any; label: string; path: string }) => {
    const isActive = location.pathname === item.path;
    
    const linkContent = (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-xl transition-all font-medium text-sm",
          isCollapsed ? "justify-center p-3" : "px-4 py-3",
          isActive 
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        )}
      >
        <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary-foreground")} />
        {!isCollapsed && <span>{item.label}</span>}
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
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        role="navigation"
        className={cn(
          "fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-50 safe-top",
          "transition-transform duration-300 ease-out",
          isCollapsed ? "w-20" : "w-72",
          isOpen 
            ? "translate-x-0 shadow-2xl animate-slide-in-left" 
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn(
          "h-16 flex items-center border-b border-sidebar-border relative",
          isCollapsed ? "justify-center px-2" : "px-5"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center relative shadow-lg shadow-primary/30">
                <Brain className="w-6 h-6 text-primary-foreground" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full animate-pulse ring-2 ring-sidebar" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">JARVIS</h1>
                <p className="text-xs text-muted-foreground font-mono">v2.0</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center relative shadow-lg shadow-primary/30">
              <Brain className="w-6 h-6 text-primary-foreground" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full animate-pulse ring-2 ring-sidebar" />
            </div>
          )}
          {/* Close button - mobile */}
          {isOpen && (
            <button 
              onClick={onClose}
              aria-label="Cerrar menú"
              className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Collapse Toggle - Desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors z-10"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto pb-20",
          isCollapsed ? "p-2" : "p-4",
          "scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent"
        )} style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Main navigation */}
          <div className="space-y-1.5">
            {navItems.map(renderNavLink)}
          </div>

          {/* Separator */}
          <div className={cn("my-6", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />

          {/* System items */}
          <div className="space-y-1.5">
            {systemItems.map(renderNavLink)}
          </div>
        </nav>

        {/* Footer */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-sidebar-border safe-bottom bg-sidebar",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-sidebar-accent/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email?.split("@")[0] || "Usuario"}
                </p>
                <p className="text-xs text-success font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-success rounded-full" />
                  ONLINE
                </p>
              </div>
            </div>
          )}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Cerrar sesión
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-sm"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
