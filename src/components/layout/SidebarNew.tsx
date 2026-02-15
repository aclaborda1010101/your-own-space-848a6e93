import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import type { SectionVisibility } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  Sparkles,
  Languages,
  GraduationCap,
  PenLine,
  Mic,
  FileText,
  Briefcase,
  User,
  Heart,
  Lightbulb,
  CalendarDays,
  CheckSquare,
  ListTodo,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface SidebarNewProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Academy sub-items
const academyItems: { icon: any; label: string; path: string }[] = [
  { icon: Sparkles, label: "Coach", path: "/coach" },
  { icon: Languages, label: "Inglés", path: "/english" },
  { icon: GraduationCap, label: "Curso IA", path: "/ai-course" },
];

// PLAUD sub-items
const plaudItems: { icon: any; label: string; path: string }[] = [
  { icon: FileText, label: "Transcripciones", path: "/inbox" },
  { icon: Briefcase, label: "Profesional", path: "/contacts?brain=professional" },
  { icon: User, label: "Personal", path: "/contacts?brain=personal" },
  { icon: Heart, label: "Familiar", path: "/contacts?brain=family" },
  { icon: Users, label: "Contactos", path: "/contacts" },
  { icon: Lightbulb, label: "Proyectos e Ideas", path: "/projects" },
];

// Optional thematic sections
const thematicItems: { icon: any; label: string; path: string; visKey: keyof SectionVisibility }[] = [
  { icon: Trophy, label: "Deportes", path: "/sports", visKey: "sports" },
  { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition", visKey: "nutrition" },
  { icon: Wallet, label: "Finanzas", path: "/finances", visKey: "finances" },
  { icon: Activity, label: "Salud", path: "/health", visKey: "health" },
  { icon: Newspaper, label: "Noticias IA", path: "/ai-news", visKey: "ai_news" },
  { icon: PenLine, label: "Contenido", path: "/content", visKey: "content" },
];

export const SidebarNew = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarNewProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useUserSettings();
  const vis = settings.section_visibility;

  const [isPlaudOpen, setIsPlaudOpen] = useState(() => {
    return plaudItems.some(item => location.pathname + location.search === item.path || location.pathname === item.path.split("?")[0]);
  });
  const [isAcademyOpen, setIsAcademyOpen] = useState(() => {
    return academyItems.some(item => location.pathname === item.path);
  });

  // Badge: pending suggestions count
  const { data: pendingSuggestions = 0 } = useQuery({
    queryKey: ["sidebar-pending-suggestions", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("commitments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Badge: overdue tasks count
  const { data: overdueTasks = 0 } = useQuery({
    queryKey: ["sidebar-overdue-tasks", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("completed", false)
        .lt("due_date", new Date().toISOString());
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const filteredThematicItems = thematicItems.filter(i => vis[i.visKey]);
  const showAcademy = vis.academy;

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const isItemActive = (path: string) => {
    if (path.includes("?")) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const renderNavLink = (item: { icon: any; label: string; path: string }, badge?: number) => {
    const isActive = isItemActive(item.path);
    
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
        {!isCollapsed && (
          <span className="flex-1 flex items-center justify-between">
            <span>{item.label}</span>
            {badge !== undefined && badge > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                {badge > 99 ? "99+" : badge}
              </Badge>
            )}
          </span>
        )}
        {isCollapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="relative">{linkContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {item.label}{badge ? ` (${badge})` : ""}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const renderCollapsibleSection = (
    label: string,
    icon: any,
    items: { icon: any; label: string; path: string }[],
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    bgClass?: string
  ) => {
    const Icon = icon;
    const isAnyActive = items.some(item => isItemActive(item.path));

    if (isCollapsed) {
      return (
        <div className="space-y-1.5">
          {items.map(item => renderNavLink(item))}
        </div>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all font-medium text-sm",
          isAnyActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        )}>
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className={cn("pl-4 mt-1 space-y-1", bgClass)}>
          {items.map((item) => {
            const active = isItemActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all font-medium text-sm px-4 py-2.5",
                  active 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", active && "text-primary-foreground")} />
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

        {/* Collapse Toggle */}
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
          {/* Principal items */}
          <div className="space-y-1.5">
            {renderNavLink({ icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" })}
            {renderNavLink({ icon: MessageSquare, label: "JARVIS", path: "/chat" }, pendingSuggestions)}
            
            {/* PLAUD collapsible */}
            {renderCollapsibleSection("PLAUD", Mic, plaudItems, isPlaudOpen, setIsPlaudOpen, "bg-sidebar-accent/30 rounded-lg py-1")}
            
            {renderNavLink({ icon: CalendarDays, label: "Calendario", path: "/calendar" })}
            {renderNavLink({ icon: ListTodo, label: "Tareas", path: "/tasks" }, overdueTasks)}
            {vis.communications && renderNavLink({ icon: Mail, label: "Comunicaciones", path: "/communications" })}
            {renderNavLink({ icon: Settings, label: "Ajustes", path: "/settings" })}
          </div>

          {/* Thematic optional sections */}
          {filteredThematicItems.length > 0 && (
            <>
              <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
              <div className="space-y-1.5">
                {filteredThematicItems.map(item => renderNavLink(item))}
              </div>
            </>
          )}

          {/* Academy section */}
          {showAcademy && (
            <>
              <div className={cn("my-4", isCollapsed ? "mx-2" : "mx-3", "border-t border-sidebar-border")} />
              {renderCollapsibleSection("Formación", GraduationCap, academyItems, isAcademyOpen, setIsAcademyOpen)}
            </>
          )}
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
