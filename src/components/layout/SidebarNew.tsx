import { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  Brain,
  LayoutDashboard,
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
  Search,
  Zap,
  TerminalSquare,
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
  badge?: string;
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
    icon: Zap,
    collapsible: false,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: Brain, label: "Bandeja inteligencia", path: "/intelligence/inbox" },
      { icon: TerminalSquare, label: "OpenClaw Hub", path: "/openclaw/hub" },
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
      { icon: ContactRound, label: "Red Estratégica", path: "/red-estrategica" },
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
    items: [
      { icon: Settings, label: "Ajustes", path: "/settings" },
      { icon: Gauge, label: "Consumos IA", path: "/ai-costs" },
    ],
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

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
    requestAnimationFrame(() => {
      document.querySelector('[data-sidebar-active="true"]')?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, [location.pathname, isHidden, isActive]);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => {
          if (isHidden(i.path)) return false;
          if (q && !i.label.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [isHidden, searchQuery]);

  // ── Link renderer ──

  const renderLink = (item: NavItem, nested = false) => {
    const active = isActive(item.path);

    const link = (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onClose}
        data-sidebar-active={active ? "true" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl font-medium select-none",
          "transition-all duration-150 ease-out",
          isCollapsed
            ? "justify-center p-2.5 mx-auto"
            : nested
              ? "px-3 py-2 text-[13px] ml-1"
              : "px-3 py-2.5 text-[13px]",
          active
            ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]"
            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
        )}
      >
        {/* Left accent bar with glow */}
        {active && !isCollapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
        )}

        {/* Icon */}
        <span
          className={cn(
            "relative flex items-center justify-center shrink-0",
            isCollapsed ? "w-5 h-5" : nested ? "w-4 h-4" : "w-[18px] h-[18px]"
          )}
        >
          <item.icon
            className={cn(
              "w-full h-full transition-all duration-200",
              active
                ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
                : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
            )}
            strokeWidth={active ? 2.2 : 1.8}
          />
          {active && (
            <span className="absolute inset-0 rounded-full bg-primary/25 blur-[8px] -z-10" />
          )}
        </span>

        {/* Label */}
        {!isCollapsed && (
          <span className={cn("truncate leading-none", active ? "font-semibold" : "font-normal")}>
            {item.label}
          </span>
        )}

        {/* Badge */}
        {!isCollapsed && item.badge && (
          <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
            {item.badge}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={14} className="text-xs font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  // ── Section renderer ──

  const renderSection = (section: (typeof filteredSections)[0], index: number) => {
    const sectionActive = section.items.some((i) => isActive(i.path));
    const sectionOpen = openSections[section.key] ?? true;

    if (!section.collapsible) {
      return (
        <div key={section.key} className="space-y-0.5">
          {!isCollapsed && index > 0 && (
            <div className="px-3 pt-5 pb-1.5 flex items-center gap-2">
              <span className="h-px flex-1 bg-sidebar-border/40" />
              <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                {section.label}
              </p>
              <span className="h-px flex-1 bg-sidebar-border/40" />
            </div>
          )}
          {isCollapsed && index > 0 && <div className="h-2" />}
          {section.items.map((item) => renderLink(item))}
        </div>
      );
    }

    if (isCollapsed) {
      return (
        <div key={section.key} className="space-y-0.5">
          <div className="mx-auto my-2.5 w-5 h-px bg-sidebar-border/50 rounded-full" />
          {section.items.map((item) => renderLink(item))}
        </div>
      );
    }

    return (
      <Collapsible key={section.key} open={sectionOpen} onOpenChange={() => toggleSection(section.key)}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg transition-all duration-200 mt-5 mb-0.5 group/section">
          <div className="flex items-center gap-2">
            <section.icon
              className={cn(
                "w-3.5 h-3.5 transition-colors duration-200",
                sectionActive ? "text-primary/60" : "text-muted-foreground/40"
              )}
            />
            <span
              className={cn(
                "text-[9px] font-mono font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                sectionActive
                  ? "text-primary/70"
                  : "text-muted-foreground/50 group-hover/section:text-muted-foreground"
              )}
            >
              {section.label}
            </span>
            {sectionActive && (
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground/30 transition-all duration-300 group-hover/section:text-muted-foreground/60",
              sectionOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 animate-in slide-in-from-top-2 fade-in duration-200">
          {section.items.map((item) => renderLink(item, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // ── Main render ──

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        className={cn(
          "fixed top-0 left-0 h-full z-50 safe-top flex flex-col",
          "bg-sidebar/95 backdrop-blur-2xl border-r border-sidebar-border/60",
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isCollapsed ? "w-[66px]" : "w-[252px]",
          isOpen ? "translate-x-0 shadow-2xl shadow-background/80" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Ambient glow background */}
        <div className="absolute top-0 -left-16 w-32 h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-16 w-28 h-52 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        {/* ─── Header ─── */}
        <div
          className={cn(
            "relative flex items-center shrink-0 border-b border-sidebar-border/40",
            isCollapsed ? "justify-center px-2 h-[60px]" : "px-4 h-[60px]"
          )}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-[12px] bg-gradient-to-br from-primary via-primary/90 to-primary/50 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.45)]">
                <Brain className="w-[19px] h-[19px] text-primary-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full ring-2 ring-sidebar animate-pulse shadow-[0_0_6px_hsl(var(--success)/0.8)]" />
              </div>
              <div className="leading-none">
                <h1 className="font-display text-[14px] font-bold text-sidebar-foreground tracking-tight">
                  JARVIS
                </h1>
                <p className="text-[9px] text-primary/60 font-mono mt-[3px] tracking-[0.15em] uppercase">
                  v11 · ONLINE
                </p>
              </div>
            </div>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="relative w-9 h-9 rounded-[12px] bg-gradient-to-br from-primary via-primary/90 to-primary/50 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.45)] cursor-default">
                  <Brain className="w-[19px] h-[19px] text-primary-foreground" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full ring-2 ring-sidebar animate-pulse" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={14} className="text-xs font-bold">
                JARVIS v11
              </TooltipContent>
            </Tooltip>
          )}

          {isOpen && (
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden lg:flex absolute -right-3 top-[52px] w-6 h-6 rounded-full",
            "bg-sidebar border border-sidebar-border items-center justify-center",
            "text-muted-foreground/60 hover:text-primary hover:border-primary/40",
            "transition-all z-10 shadow-sm"
          )}
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Search */}
        {!isCollapsed && (
          <div className="relative px-3 pt-3 pb-0.5 shrink-0">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 border transition-all duration-200",
                searchFocused
                  ? "border-primary/40 bg-primary/[0.06] shadow-[0_0_16px_-4px_hsl(var(--primary)/0.3)]"
                  : "border-sidebar-border/30 hover:border-sidebar-border/60 bg-sidebar-accent/20"
              )}
            >
              <Search
                className={cn(
                  "w-3.5 h-3.5 shrink-0 transition-colors",
                  searchFocused ? "text-primary" : "text-muted-foreground/40"
                )}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Buscar…"
                className="bg-transparent text-xs text-sidebar-foreground placeholder:text-muted-foreground/40 outline-none w-full"
              />
              <kbd className="text-[9px] font-mono text-muted-foreground/50 px-1.5 py-0.5 rounded bg-sidebar-accent/40 border border-sidebar-border/50">
                ⌘K
              </kbd>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav
          className={cn(
            "relative flex-1 overflow-y-auto overscroll-contain",
            isCollapsed ? "px-2 py-2" : "px-2 py-1"
          )}
        >
          {filteredSections.map((s, i) => renderSection(s, i))}

          {filteredSections.length === 0 && searchQuery && (
            <div className="px-3 py-10 text-center">
              <Search className="w-5 h-5 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/40">
                Sin resultados para "<span className="text-muted-foreground/60">{searchQuery}</span>"
              </p>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "relative border-t border-sidebar-border/40 safe-bottom shrink-0",
            isCollapsed ? "p-2" : "p-2.5"
          )}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1.5 rounded-xl bg-gradient-to-br from-sidebar-accent/30 to-sidebar-accent/10 border border-sidebar-border/30">
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0 shadow-[0_0_12px_hsl(var(--primary)/0.35)]">
                <span className="text-[11px] font-bold text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0 leading-none">
                <p className="text-[12px] font-semibold text-sidebar-foreground truncate">
                  {user?.email?.split("@")[0] || "Usuario"}
                </p>
                <p className="text-[9px] text-success/70 font-mono flex items-center gap-1 mt-[3px] uppercase tracking-wider">
                  <span className="w-[5px] h-[5px] bg-success rounded-full animate-pulse shadow-[0_0_4px_hsl(var(--success)/0.8)]" />
                  online
                </p>
              </div>
            </div>
          )}

          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-2.5 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={14}>
                Cerrar sesión
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
