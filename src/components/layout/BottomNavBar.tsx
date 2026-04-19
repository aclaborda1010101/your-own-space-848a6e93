import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CheckSquare,
  Mic,
  Activity,
  Menu as MenuIcon,
  X,
  LayoutDashboard,
  TerminalSquare,
  Calendar,
  Trophy,
  Briefcase,
  Radar,
  ShieldCheck,
  Upload,
  ContactRound,
  Newspaper,
  UtensilsCrossed,
  Wallet,
  Baby,
  Sparkles,
  Languages,
  GraduationCap,
  PenLine,
  Gauge,
  Settings,
  LogOut,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

interface BottomNavBarProps {
  onJarvisPress?: () => void;
  isJarvisActive?: boolean;
}

const primary = [
  { icon: CalendarCheck, label: "Hoy", path: "/dashboard" },
  { icon: CheckSquare, label: "Tareas", path: "/tasks" },
  { icon: Activity, label: "Salud", path: "/health" },
];

type MenuLink = { icon: any; label: string; path: string };
type MenuGroup = { label: string; items: MenuLink[] };

const menuGroups: MenuGroup[] = [
  {
    label: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: TerminalSquare, label: "OpenClaw Hub", path: "/openclaw/hub" },
      { icon: Calendar, label: "Calendario", path: "/calendar" },
      { icon: Trophy, label: "Deportes", path: "/sports" },
    ],
  },
  {
    label: "Proyectos",
    items: [
      { icon: Briefcase, label: "Proyectos", path: "/projects" },
      { icon: Radar, label: "Detector Patrones", path: "/projects/detector" },
      { icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia" },
    ],
  },
  {
    label: "Datos",
    items: [
      { icon: Upload, label: "Importar", path: "/data-import" },
      { icon: ContactRound, label: "Red Estratégica", path: "/red-estrategica" },
      { icon: Mic, label: "Comunicaciones", path: "/communications" },
    ],
  },
  {
    label: "Módulos",
    items: [
      { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
      { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition" },
      { icon: Wallet, label: "Finanzas", path: "/finances" },
      { icon: Gauge, label: "Mi Estado", path: "/agustin/state" },
      { icon: PenLine, label: "Contenido", path: "/content" },
    ],
  },
  {
    label: "Bosco",
    items: [
      { icon: Baby, label: "Actividades", path: "/bosco" },
      { icon: Brain, label: "Análisis Profundo", path: "/bosco/analysis" },
    ],
  },
  {
    label: "Formación",
    items: [
      { icon: Sparkles, label: "Coach", path: "/coach" },
      { icon: Languages, label: "Inglés", path: "/english" },
      { icon: GraduationCap, label: "Curso IA", path: "/ai-course" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Settings, label: "Ajustes", path: "/settings" },
      { icon: Gauge, label: "Consumos IA", path: "/ai-costs" },
    ],
  },
];

export const BottomNavBar = ({ onJarvisPress, isJarvisActive = false }: BottomNavBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selection } = useHaptics();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const tap = () => selection();

  const handleJarvis = () => {
    selection();
    if (onJarvisPress) onJarvisPress();
    else navigate("/chat");
  };

  const handleNavTo = (path: string) => {
    selection();
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden safe-bottom"
        aria-label="Navegación principal"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[65%] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative bg-background/85 backdrop-blur-2xl border-t border-border/60 bg-scanlines">
          <div className="flex items-end justify-around h-16 px-1">
            {/* Hoy */}
            <NavItem item={primary[0]} active={location.pathname === primary[0].path} onClick={tap} />
            {/* Tareas */}
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
                    : "bg-gradient-to-br from-primary via-primary to-primary/70 border-primary/40 shadow-[0_0_24px_hsl(var(--primary)/0.7)]"
                )}
              >
                <Mic
                  className={cn(
                    "w-6 h-6",
                    isJarvisActive ? "animate-pulse text-destructive" : "text-primary-foreground"
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold uppercase tracking-wider mt-0.5",
                  isJarvisActive ? "text-destructive" : "text-primary"
                )}
              >
                JARVIS
              </span>
            </button>

            {/* Salud */}
            <NavItem item={primary[2]} active={location.pathname === primary[2].path} onClick={tap} />

            {/* Menú */}
            <button
              onClick={() => {
                selection();
                setMenuOpen(true);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all touch-manipulation min-w-[60px]",
                menuOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Abrir menú"
            >
              <MenuIcon className="w-5 h-5" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
                Menú
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Sheet Menú a pantalla completa */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-full p-0 flex flex-col bg-background/95 backdrop-blur-xl"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <SheetTitle className="text-left font-serif text-2xl">Menú</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {menuGroups.map((group) => (
              <div key={group.label} className="mb-5">
                <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((it) => {
                    const Icon = it.icon;
                    const active = location.pathname === it.path;
                    return (
                      <button
                        key={it.path}
                        onClick={() => handleNavTo(it.path)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-3 rounded-xl border transition-all text-left touch-manipulation",
                          active
                            ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
                            : "bg-card/40 border-border/40 hover:bg-card/70"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium truncate">{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={async () => {
                selection();
                setMenuOpen(false);
                await signOut();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 mb-6 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive font-medium touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
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
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
      )}
      <Icon
        className={cn(
          "w-5 h-5 transition-transform",
          active && "scale-110 drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
        )}
      />
      <span
        className={cn(
          "text-[10px] font-mono font-semibold uppercase tracking-wider",
          active && "text-primary"
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}
