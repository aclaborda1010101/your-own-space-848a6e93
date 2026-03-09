import { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  Brain,
  LayoutDashboard,
  MessageSquare,
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
  Mic,
  Database,
  Upload,
  ContactRound,
  CheckSquare,
  Calendar,
  Briefcase,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ── Types ──────────────────────────────────────────────────────────

interface SidebarNewProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavSection {
  key: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  collapsible: boolean;
  defaultOpen?: boolean;
}

// ── Navigation Structure ───────────────────────────────────────────

const sections: NavSection[] = [
  {
    key: "principal",
    label: "Principal",
    icon: LayoutDashboard,
    collapsible: false,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: MessageSquare, label: "JARVIS", path: "/chat" },
      { icon: Mic, label: "Comunicaciones", path: "/communications" },
      { icon: CheckSquare, label: "Tareas", path: "/tasks" },
      { icon: Calendar, label: "Calendario", path: "/calendar" },
      { icon: Activity, label: "Salud", path: "/health" },
      { icon: Trophy, label: "Deportes", path: "/sports" },
    ],
  },
  {
    key: "proyectos",
    label: "Proyectos",
    icon: Briefcase,
    collapsible: true,
    defaultOpen: true,
    items: [
      { icon: Briefcase, label: "Proyectos", path: "/projects" },
      { icon: Database, label: "RAG Architect", path: "/rag-architect" },
      { icon: Radar, label: "Detector Patrones", path: "/projects/detector" },
      { icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia" },
    ],
  },
  {
    key: "datos",
    label: "Datos",
    icon: Database,
    collapsible: true,
    defaultOpen: true,
    items: [
      { icon: Upload, label: "Importar", path: "/data-import" },
      { icon: ContactRound, label: "Red Estratégica", path: "/strategic-network" },
    ],
  },
  {
    key: "modulos",
    label: "Módulos",
    icon: Gauge,
    collapsible: true,
    defaultOpen: true,
    items: [
      { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
      { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition" },
      { icon: Wallet, label: "Finanzas", path: "/finances" },
      { icon: Gauge, label: "Mi Estado", path: "/agustin/state" },
      { icon: PenLine, label: "Contenido", path: "/content" },
    ],
  },
  {
    key: "bosco",
    label: "Bosco",
    icon: Baby,
    collapsible: true,
    defaultOpen: true,
    items: [
      { icon: Baby, label: "Actividades", path: "/bosco" },
      { icon: Brain, label: "Análisis Profundo", path: "/bosco/analysis" },
    ],
  },
  {
    key: "formacion",
    label: "Formación",
    icon: GraduationCap,
    collapsible: true,
    defaultOpen: true,
    items: [
      { icon: Sparkles, label: "Coach", path: "/coach" },
      { icon: Languages, label: "Inglés", path: "/english" },
      { icon: GraduationCap, label: "Curso IA", path: "/ai-course" },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    icon: Settings,
    collapsible: false,
    items: [{ icon: Settings, label: "Ajustes", path: "/settings" }],
  },
];

// ── Helpers ────────────────────────────────────────────────────────

const safeGet = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
};

const normalizePath = (p: string) => p.trim().replace(/\/+$/, "");

// ── Component ──────────────────────────────────────────────────────

export const SidebarNew = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarNewProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useUserSettings();

  const hiddenItems = useMemo(
    () => (settings.hidden_menu_items || []).map(normalizePath),
    [settings.hidden_menu_items]
  );

  const isHidden = useCallback(
    (path: string) => hiddenItems.includes(normalizePath(path)),
    [hiddenItems]
  );

  const isActive = useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(path + "/"),
    [location.pathname]
  );

  // ── Section open states (persisted per section) ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.collapsible) {
        const saved = safeGet(`sidebar-v11-${s.key}`);
        initial[s.key] = saved !== null ? saved === "true" : (s.defaultOpen ?? true);
      }
    });
    return initial;
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      safeSet(`sidebar-v11-${key}`, String(next[key]));
      return next;
    });
  }, []);

  // Auto-open section containing active route
  useEffect(() => {
    sections.forEach((s) => {
      if (s.collapsible && s.items.some((i) => !isHidden(i.path) && isActive(i.path))) {
        setOpenSections((prev) => {
          if (prev[s.key]) return prev;
          const next = { ...prev, [s.key]: true };
          safeSet(`sidebar-v11-${s.key}`, "true");
          return next;
        });
      }
    });
    // Auto-scroll to active item
    requestAnimationFrame(() => {
      document.querySelector('[data-sidebar-active="true"]')?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, [location.pathname, isHidden, isActive]);

  // Cleanup old localStorage keys
  useEffect(() => {
    try {
      ["sidebar-section-projects", "sidebar-section-projects-v2", "sidebar-section-academy", "sidebar-section-bosco", "sidebar-section-data"].forEach(
        (k) => localStorage.removeItem(k)
      );
    } catch { /* ignore */ }
  }, []);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  // ── Filtered sections ──
  const filteredSections = useMemo(
    () =>
      sections
        .map((s) => ({ ...s, items: s.items.filter((i) => !isHidden(i.path)) }))
        .filter((s) => s.items.length > 0),
    [isHidden]
  );

  // ── Render helpers ──

  const renderLink = (item: NavItem, nested = false) => {
    const active = isActive(item.path);

    const linkContent = (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onClose}
        data-sidebar-active={active ? "true" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg transition-all duration-200 font-medium",
          isCollapsed ? "justify-center p-2.5" : nested ? "px-3 py-2 text-[13px]" : "px-3 py-2.5 text-sm",
          active
            ? "bg-primary/15 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 border border-transparent"
        )}
      >
        <item.icon
          className={cn(
            "shrink-0 transition-colors",
            isCollapsed ? "w-5 h-5" : nested ? "w-4 h-4" : "w-[18px] h-[18px]",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        {!isCollapsed && (
          <span className={cn("truncate", active && "text-primary font-semibold")}>
            {item.label}
          </span>
        )}
        {!isCollapsed && active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const renderSection = (section: (typeof filteredSections)[0]) => {
    const sectionActive = section.items.some((i) => isActive(i.path));
    const sectionOpen = openSections[section.key] ?? true;

    if (!section.collapsible) {
      return (
        <div key={section.key} className="space-y-0.5">
          {!isCollapsed && (
            <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
              {section.label}
            </p>
          )}
          {isCollapsed && <div className="h-3" />}
          {section.items.map((item) => renderLink(item))}
        </div>
      );
    }

    if (isCollapsed) {
      return (
        <div key={section.key} className="space-y-0.5">
          <div className="h-3" />
          {section.items.map((item) => renderLink(item))}
        </div>
      );
    }

    return (
      <Collapsible key={section.key} open={sectionOpen} onOpenChange={() => toggleSection(section.key)}>
        <CollapsibleTrigger
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all duration-200 text-[10px] font-bold uppercase tracking-[0.15em] mt-4 mb-0.5",
            sectionActive
              ? "text-primary/80"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <section.icon className="w-3.5 h-3.5" />
            <span>{section.label}</span>
            {sectionActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform duration-200",
              sectionOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pl-1 animate-in slide-in-from-top-1 duration-200">
          {section.items.map((item) => renderLink(item, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // ── Render ──

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
          "fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-50 safe-top flex flex-col",
          "transition-all duration-300 ease-out",
          isCollapsed ? "w-[68px]" : "w-[260px]",
          isOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "h-14 flex items-center border-b border-sidebar-border relative shrink-0",
            isCollapsed ? "justify-center px-2" : "px-4"
          )}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center relative shadow-md shadow-primary/20">
                <Brain className="w-5 h-5 text-primary-foreground" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full ring-2 ring-sidebar" />
              </div>
              <div className="leading-none">
                <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">JARVIS</h1>
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">v11.0</p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center relative shadow-md shadow-primary/20">
              <Brain className="w-5 h-5 text-primary-foreground" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full ring-2 ring-sidebar" />
            </div>
          )}

          {/* Close button - mobile */}
          {isOpen && (
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse Toggle - Desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-[52px] w-6 h-6 rounded-full bg-sidebar border border-sidebar-border items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all z-10 shadow-sm"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain",
            isCollapsed ? "px-2 py-2" : "px-3 py-1",
            "scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent"
          )}
        >
          {filteredSections.map(renderSection)}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-sidebar-border safe-bottom shrink-0",
            isCollapsed ? "p-2" : "p-3"
          )}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mb-2 bg-sidebar-accent/30 rounded-lg">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0 leading-none">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email?.split("@")[0] || "Usuario"}
                </p>
                <p className="text-[10px] text-success font-mono flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 bg-success rounded-full" />
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-sm"
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
