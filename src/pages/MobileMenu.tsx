import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Mic,
  Search,
  ChevronRight,
  LayoutDashboard,
  TerminalSquare,
  CheckSquare,
  Calendar as CalIcon,
  Activity,
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
  PenLine,
  Languages,
  GraduationCap,
  Settings,
  Gauge,
  Brain,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { JarvisCommandPalette } from "@/components/menu/JarvisCommandPalette";


type Item = {
  icon: LucideIcon;
  label: string;
  path: string;
  meta?: string;
  badge?: string | number;
};

type Section = {
  label: string;
  items: Item[];
};

export default function MobileMenu() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [counts, setCounts] = useState<{
    tasksPending: number;
    tasksDone: number;
    contacts: number;
    whoopRecovery: number | null;
    aiCostsMonth: number | null;
    suggestionsPending: number;
  }>({ tasksPending: 0, tasksDone: 0, contacts: 0, whoopRecovery: null, aiCostsMonth: null, suggestionsPending: 0 });

  // SEO title
  useEffect(() => {
    document.title = "JARVIS · Menú";
  }, []);

  // Fetch live metadata for cards
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const uid = user.id;
    (async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      const pendingP: any = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("completed", false);
      const doneP: any = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("completed", true)
        .gte("updated_at", startOfDay);
      const contactsP: any = supabase
        .from("people_contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      const whoopP: any = supabase
        .from("jarvis_whoop_data")
        .select("recovery_score, data_date")
        .eq("user_id", uid)
        .order("data_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const costsP: any = supabase
        .from("project_costs")
        .select("cost_usd")
        .eq("user_id", uid)
        .gte("created_at", startOfMonth);
      const suggestionsP: any = supabase
        .from("suggestions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "pending");

      const [pending, done, contacts, whoop, costs, suggestions] = await Promise.all([
        pendingP,
        doneP,
        contactsP,
        whoopP,
        costsP,
        suggestionsP,
      ]);

      if (cancelled) return;
      const totalCost = (costs.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.cost_usd ?? 0),
        0,
      );

      setCounts({
        tasksPending: pending.count ?? 0,
        tasksDone: done.count ?? 0,
        contacts: contacts.count ?? 0,
        whoopRecovery: whoop.data?.recovery_score ?? null,
        aiCostsMonth: totalCost > 0 ? totalCost : null,
        suggestionsPending: suggestions.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const sections: Section[] = useMemo(() => {
    const monthLabel = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const monthStr = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    return [
      {
        label: "Principal",
        items: [
          { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", meta: "Briefing del día" },
          { icon: TerminalSquare, label: "OpenClaw Hub", path: "/openclaw/hub", meta: "Nodos · Supabase" },
          {
            icon: CheckSquare,
            label: "Tareas",
            path: "/tasks",
            meta: `${counts.tasksPending} pendientes · ${counts.tasksDone} hechas hoy`,
            badge: counts.tasksPending || undefined,
          },
          {
            icon: Brain,
            label: "Bandeja inteligencia",
            path: "/intelligence/inbox",
            meta: counts.suggestionsPending > 0
              ? `${counts.suggestionsPending} sugerencias pendientes`
              : "Sin sugerencias pendientes",
            badge: counts.suggestionsPending || undefined,
          },
          { icon: CalIcon, label: "Calendario", path: "/calendar", meta: monthStr },
          {
            icon: Activity,
            label: "Salud",
            path: "/health",
            meta: counts.whoopRecovery !== null ? `Whoop · ${counts.whoopRecovery}% recup.` : "Whoop · sin datos",
          },
          { icon: Trophy, label: "Deportes", path: "/sports", meta: "Sesiones y récords" },
        ],
      },
      {
        label: "Proyectos",
        items: [
          { icon: Briefcase, label: "Proyectos", path: "/projects", meta: "Pipeline activo" },
          { icon: Radar, label: "Detector de Patrones", path: "/projects/detector", meta: "LUDA · modelo válido" },
          { icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia", meta: "Radiografías" },
        ],
      },
      {
        label: "Datos",
        items: [
          { icon: Upload, label: "Importar", path: "/data-import", meta: "WhatsApp · Plaud · Email" },
          {
            icon: ContactRound,
            label: "Red Estratégica",
            path: "/red-estrategica",
            meta: `${counts.contacts.toLocaleString("es-ES")} contactos`,
            badge: counts.contacts >= 1000 ? `${(counts.contacts / 1000).toFixed(1)}k` : counts.contacts,
          },
        ],
      },
      {
        label: "Módulos",
        items: [
          { icon: Newspaper, label: "Noticias IA", path: "/ai-news", meta: "Resumen diario" },
          { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition", meta: "Registro y plan" },
          { icon: Wallet, label: "Finanzas", path: "/finances", meta: "Movimientos" },
          { icon: Baby, label: "Bosco", path: "/bosco", meta: "Actividades" },
          { icon: Brain, label: "Bosco · Análisis", path: "/bosco/analysis", meta: "Inteligencias múltiples" },
          { icon: PenLine, label: "Contenido", path: "/content", meta: "Drafts y publicaciones" },
        ],
      },
      {
        label: "Formación",
        items: [
          { icon: Sparkles, label: "Coach", path: "/coach", meta: "Sesiones IA" },
          { icon: Languages, label: "Inglés", path: "/english", meta: "Práctica diaria" },
          { icon: GraduationCap, label: "Curso IA", path: "/ai-course", meta: "Lecciones" },
        ],
      },
      {
        label: "Sistema",
        items: [
          { icon: Settings, label: "Ajustes", path: "/settings", meta: "Preferencias y cuenta" },
          {
            icon: Gauge,
            label: "Consumos IA",
            path: "/ai-costs",
            meta: counts.aiCostsMonth !== null ? `${counts.aiCostsMonth.toFixed(2)} $ este mes` : "Sin uso este mes",
          },
        ],
      },
    ];
  }, [counts]);

  const userInitial = (user?.email ?? "?").charAt(0).toUpperCase();
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "agustin";

  const buildLabel = `BUILD ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")}`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <meta name="description" content="JARVIS OS · Panel de control con accesos rápidos, módulos, datos y sistema." />

      <div className="mx-auto max-w-md px-4 pt-5">
        {/* Header */}
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.35)]">
              <span className="absolute inset-1.5 rounded-lg bg-primary" />
            </div>
            <div className="leading-tight">
              <div className="font-mono text-base tracking-wider text-foreground">JARVIS</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                v10 · ManIAS Lab
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-[10px] font-mono uppercase tracking-widest text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            Online
          </span>
        </header>

        {/* Search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/40 transition mb-4 text-left"
          aria-label="Buscar en JARVIS"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">Buscar en JARVIS…</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-background/60 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <QuickAction
            icon={Sparkles}
            label="Briefing"
            primary
            onClick={() => navigate("/dashboard")}
          />
          <QuickAction
            icon={Plus}
            label="Nueva tarea"
            onClick={() => navigate("/tasks?new=1")}
          />
          <QuickAction icon={Mic} label="Dictar" onClick={() => navigate("/chat")} />
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            <div className="px-1 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {section.label}
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden divide-y divide-border/40">
              {section.items.map((it) => (
                <MenuRow key={it.path} item={it} onClick={() => navigate(it.path)} />
              ))}
            </div>
          </div>
        ))}

        {/* User card */}
        <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center font-mono text-sm">
            {userInitial}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium truncate">{userName}</div>
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              online
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70 pb-4">
          JARVIS OS · {buildLabel} · HAIKU-4.5
        </div>
      </div>

      <JarvisCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border transition-all touch-manipulation",
        primary
          ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.25)] hover:bg-primary/20"
          : "bg-card/50 border-border/60 hover:bg-card/80 hover:border-primary/30 text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function MenuRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition text-left touch-manipulation"
    >
      <div className="w-9 h-9 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        {item.meta && (
          <div className="text-[11px] font-mono text-muted-foreground truncate">{item.meta}</div>
        )}
      </div>
      {item.badge !== undefined && (
        <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[11px] font-mono text-primary">
          {item.badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
