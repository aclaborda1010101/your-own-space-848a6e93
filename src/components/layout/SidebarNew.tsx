import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
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
  ChevronDown,
  LogOut,
  Newspaper,
  UtensilsCrossed,
  Wallet,
  Baby,
  Sparkles,
  Languages,
  GraduationCap,
  PenLine,
  Gauge,
  Users,
  Mic,
  Database,
  Upload,
  ContactRound
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SidebarNewProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Menú principal
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, label: "JARVIS", path: "/chat" },
  { icon: Mic, label: "Comunicaciones", path: "/communications" },
  { icon: Users, label: "Red Estratégica", path: "/strategic-network" },
  { icon: Brain, label: "Dashboard Cerebros", path: "/brains-dashboard" },
  { icon: Activity, label: "Salud", path: "/health" },
  { icon: Trophy, label: "Deportes", path: "/sports" },
];

// Datos submenu
const dataItems = [
  { icon: Upload, label: "Importar", path: "/data-import" },
  { icon: ContactRound, label: "Contactos", path: "/contacts" },
];

// Módulos adicionales
const moduleItems = [
  { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
  { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition" },
  { icon: Wallet, label: "Finanzas", path: "/finances" },
  { icon: Gauge, label: "Mi Estado", path: "/agustin/state" },
  { icon: PenLine, label: "Contenido", path: "/content" },
];

// Bosco submenu items
const boscoItems = [
  { icon: Baby, label: "Actividades", path: "/bosco" },
  { icon: Brain, label: "Análisis Profundo", path: "/bosco/analysis" },
];

// Academia/Formación
const academyItems = [
  { icon: Sparkles, label: "Coach", path: "/coach" },
  { icon: Languages, label: "Inglés", path: "/english" },
  { icon: GraduationCap, label: "Curso IA", path: "/ai-course" },
];

const systemItems = [
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export const SidebarNew = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarNewProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useUserSettings();
  const hiddenItems = settings.hidden_menu_items || [];

  const filteredNavItems = navItems.filter(item => !hiddenItems.includes(item.path));
  const filteredModuleItems = moduleItems.filter(item => !hiddenItems.includes(item.path));
  const filteredBoscoItems = boscoItems.filter(item => !hiddenItems.includes(item.path));
  const filteredAcademyItems = academyItems.filter(item => !hiddenItems.includes(item.path));
  const filteredDataItems = dataItems.filter(item => !hiddenItems.includes(item.path));

  const [isAcademyOpen, setIsAcademyOpen] = useState(() => {
    return academyItems.some(item => location.pathname === item.path);
  });
  const [isBoscoOpen, setIsBoscoOpen] = useState(() => {
    return boscoItems.some(item => location.pathname === item.path);
  });
  const [isDataOpen, setIsDataOpen] = useState(() => {
    return dataItems.some(item => location.pathname === item.path);
  });

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

  const renderAcademySection = () => {
    if (filteredAcademyItems.length === 0) return null;
    const isAnyActive = filteredAcademyItems.some(item => location.pathname === item.path);

    if (isCollapsed) {
      return (
        <div className="space-y-1.5">
          {filteredAcademyItems.map(renderNavLink)}
        </div>
      );
    }

    return (
      <Collapsible open={isAcademyOpen} onOpenChange={setIsAcademyOpen}>
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all font-medium text-sm",
          isAnyActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        )}>
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 shrink-0" />
            <span>Formación</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            isAcademyOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 mt-1 space-y-1">
          {filteredAcademyItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all font-medium text-sm px-4 py-2.5",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary-foreground")} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderBoscoSection = () => {
    if (filteredBoscoItems.length === 0) return null;
    const isAnyActive = filteredBoscoItems.some(item => location.pathname === item.path);

    if (isCollapsed) {
      return (
        <div className="space-y-1.5">
          {filteredBoscoItems.map(renderNavLink)}
        </div>
      );
    }

    return (
      <Collapsible open={isBoscoOpen} onOpenChange={setIsBoscoOpen}>
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all font-medium text-sm",
          isAnyActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        )}>
          <div className="flex items-center gap-3">
            <Baby className="w-5 h-5 shrink-0" />
            <span>Bosco</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            isBoscoOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 mt-1 space-y-1">
          {filteredBoscoItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all font-medium text-sm px-4 py-2.5",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary-foreground")} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderDataSection = () => {
    if (filteredDataItems.length === 0) return null;
    const isAnyActive = filteredDataItems.some(item => location.pathname === item.path);

    if (isCollapsed) {
      return (
        <div className="space-y-1.5">
          {filteredDataItems.map(renderNavLink)}
        </div>
      );
    }

    return (
      <Collapsible open={isDataOpen} onOpenChange={setIsDataOpen}>
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all font-medium text-sm",
          isAnyActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        )}>
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 shrink-0" />
            <span>Datos</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            isDataOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 mt-1 space-y-1">
          {filteredDataItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all font-medium text-sm px-4 py-2.5",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary-foreground")} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
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
          "flex-1 overflow-y-auto",
          isCollapsed ? "p-2 pb-24" : "p-4 pb-40",
          "scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent"
        )} style={{ 
          maxHeight: isCollapsed 
            ? 'calc(100vh - 64px - 80px - env(safe-area-inset-bottom, 0px))' 
            : 'calc(100vh - 64px - 170px - env(safe-area-inset-bottom, 0px))' 
        }}>
          {/* Main navigation */}
          <div className="space-y-1.5">
            {filteredNavItems.map(renderNavLink)}
          </div>

          {/* Data section */}
          {filteredDataItems.length > 0 && (
            <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
          )}
          {renderDataSection()}

          {/* Separator */}
          {filteredModuleItems.length > 0 && (
            <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
          )}

          {/* Module items */}
          <div className="space-y-1.5">
            {filteredModuleItems.map(renderNavLink)}
          </div>

          {/* Separator */}
          {filteredBoscoItems.length > 0 && (
            <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
          )}

          {/* Bosco section */}
          {renderBoscoSection()}

          {/* Separator */}
          {filteredAcademyItems.length > 0 && (
            <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
          )}

          {/* Academy section */}
          {renderAcademySection()}

          {/* Separator */}
          <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />

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
