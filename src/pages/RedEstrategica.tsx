import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ContactCard } from "@/components/contact/ContactCard";
import { AddToNetworkDialog } from "@/components/contact/AddToNetworkDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  LayoutGrid,
  List,
  Network,
  Users,
  Headphones,
  Activity,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Brain,
  Plus,
  Mic,
} from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  category: string | null;
  last_contact: string | null;
  is_favorite: boolean | null;
  wa_message_count: number | null;
  scores: { health?: number } | null;
  context: string | null;
  in_strategic_network: boolean | null;
}

type ViewMode = "cards" | "list";
type RelFilter = "all" | "profesional" | "personal" | "familiar" | "otro";
type HealthFilter = "all" | "critical" | "attention" | "ok" | "strong";
type ActivityFilter = "all" | "week" | "month" | "dormant";

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "warning" | "success" | "primary";
}

function Pill({ active, onClick, children, tone = "default" }: PillProps) {
  const toneCls = {
    default: "border-border/60 hover:border-primary/40 hover:text-primary",
    primary: "border-primary/30 hover:border-primary/60 hover:text-primary",
    warning: "border-warning/30 hover:border-warning/60 hover:text-warning",
    success: "border-success/30 hover:border-success/60 hover:text-success",
  }[tone];
  const activeCls = {
    default: "bg-primary/15 border-primary/50 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]",
    primary: "bg-primary/15 border-primary/50 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]",
    warning: "bg-warning/15 border-warning/50 text-warning shadow-[0_0_16px_-4px_hsl(var(--warning)/0.5)]",
    success: "bg-success/15 border-success/50 text-success shadow-[0_0_16px_-4px_hsl(var(--success)/0.5)]",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border bg-card/30 backdrop-blur-md transition-all duration-200",
        active ? activeCls : cn("text-muted-foreground", toneCls),
      )}
    >
      {children}
    </button>
  );
}

interface KpiProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "primary" | "warning" | "success" | "accent";
}

function Kpi({ label, value, hint, icon, tone = "primary" }: KpiProps) {
  const toneCls = {
    primary: "text-primary border-primary/30 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]",
    warning: "text-warning border-warning/30 shadow-[0_0_24px_-8px_hsl(var(--warning)/0.4)]",
    success: "text-success border-success/30 shadow-[0_0_24px_-8px_hsl(var(--success)/0.4)]",
    accent: "text-accent border-accent/30 shadow-[0_0_24px_-8px_hsl(var(--accent)/0.4)]",
  }[tone];
  return (
    <GlassCard className={cn("p-5 border", toneCls)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          {label}
        </span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="font-display text-3xl font-semibold leading-none">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
    </GlassCard>
  );
}

export default function RedEstrategica() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [podcastIds, setPodcastIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("cards");
  const [rel, setRel] = useState<RelFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [hasPodcast, setHasPodcast] = useState<"all" | "yes" | "no">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function removeFromNetwork(contactId: string, name: string) {
    try {
      const { error } = await supabase
        .from("people_contacts")
        .update({ in_strategic_network: false })
        .eq("id", contactId);
      if (error) throw error;
      setRows((r) => r.filter((x) => x.id !== contactId));
      toast.success(`${name} quitado de tu red`, {
        action: {
          label: "Deshacer",
          onClick: async () => {
            await supabase
              .from("people_contacts")
              .update({ in_strategic_network: true })
              .eq("id", contactId);
            void load();
          },
        },
      });
    } catch (e) {
      toast.error("No se pudo quitar", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function refreshHeadlines() {
    if (refreshing) return;
    setRefreshing(true);
    const tId = toast.loading("Actualizando novedades de tu red…", {
      description: "Regenerando análisis con IA. Puede tardar 30-60s.",
    });
    try {
      const { data, error } = await supabase.functions.invoke(
        "contact-headlines-refresh",
        { body: {} },
      );
      if (error) throw error;
      const refreshed = data?.refreshed ?? 0;
      const errors = data?.errors ?? 0;
      const truncated = data?.truncated;
      toast.success(`Novedades actualizadas en ${refreshed} contactos`, {
        id: tId,
        description: [
          errors > 0 ? `${errors} con error` : null,
          truncated ? "Procesados los 25 más antiguos" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Cache renovado.",
      });
      void load();
    } catch (e) {
      toast.error("No se pudieron actualizar las novedades", {
        id: tId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshAllProfiles() {
    if (refreshingAll) return;
    setRefreshingAll(true);
    const tId = toast.loading("Regenerando perfiles completos…", {
      description: "Reanalizando psicológico, emocional, oportunidades. Tarda varios minutos.",
    });
    try {
      const { data, error } = await supabase.functions.invoke(
        "contact-profiles-refresh-all",
        { body: {} },
      );
      if (error) throw error;

      // Nueva respuesta async: { queued, total, message, background: true }
      const queued = data?.queued ?? 0;
      const message =
        data?.message ||
        `Refrescando ${queued} contactos en segundo plano. Vuelve en 1-2 minutos.`;

      toast.success(message, {
        id: tId,
        description: "Los perfiles se irán actualizando automáticamente.",
      });

      // Polling: refrescar la lista cada 30s durante 3 min para ver el avance.
      let ticks = 0;
      const interval = window.setInterval(() => {
        void load();
        ticks++;
        if (ticks >= 6) window.clearInterval(interval);
      }, 30_000);
      // Primer refresco en 5s para captar los primeros perfiles ya regenerados.
      window.setTimeout(() => void load(), 5_000);
    } catch (e) {
      toast.error("No se pudieron regenerar los perfiles", {
        id: tId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRefreshingAll(false);
    }
  }

  async function reimportMultimedia() {
    if (reimporting) return;
    setReimporting(true);
    const tId = toast.loading("Re-importando multimedia de WhatsApp…", {
      description: "Buscando audios, imágenes y PDFs de los últimos 21 días en tus contactos activos.",
    });
    try {
      const { data, error } = await supabase.functions.invoke(
        "reimport-whatsapp-recent",
        { body: { daysBack: 21 } },
      );
      if (error) throw error;
      toast.success(data?.message || "Re-importación encolada.", {
        id: tId,
        description: `Escaneando ${data?.contactsScanned ?? 0} contactos. Las transcripciones aparecerán en cada chat según se procesen.`,
      });
    } catch (e) {
      toast.error("No se pudo iniciar la re-importación", {
        id: tId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setReimporting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function load() {
    setLoading(true);
    try {
      const all: Row[] = [];
      let from = 0;
      const STEP = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("people_contacts")
          .select(
            "id,name,category,last_contact,is_favorite,wa_message_count,scores,context,in_strategic_network",
          )
          .eq("user_id", user!.id)
          .eq("in_strategic_network", true)
          .order("name", { ascending: true })
          .range(from, from + STEP - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as Row[]));
        if (data.length < STEP) break;
        from += STEP;
      }
      setRows(all);

      const { data: pods } = await supabase
        .from("contact_podcasts")
        .select("contact_id, total_segments")
        .eq("user_id", user!.id)
        .gt("total_segments", 0);
      setPodcastIds(new Set((pods || []).map((p) => p.contact_id)));
    } finally {
      setLoading(false);
    }
  }

  // ── KPIs ──
  const kpis = useMemo(() => {
    const now = Date.now();
    let activeWeek = 0;
    let critical = 0;
    rows.forEach((r) => {
      if (r.last_contact) {
        const days = (now - new Date(r.last_contact).getTime()) / (1000 * 60 * 60 * 24);
        if (days <= 7) activeWeek++;
      }
      const s = r.scores?.health ?? 5;
      if (s < 4) critical++;
    });
    return {
      total: rows.length,
      activeWeek,
      critical,
      podcasts: podcastIds.size,
    };
  }, [rows, podcastIds]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (search.trim() && !r.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (rel !== "all") {
        if (rel === "otro" && r.category && ["profesional", "personal", "familiar"].includes(r.category)) return false;
        if (rel !== "otro" && r.category !== rel) return false;
      }
      const score = r.scores?.health ?? 5;
      if (health !== "all") {
        if (health === "critical" && score >= 4) return false;
        if (health === "attention" && (score < 4 || score > 6)) return false;
        if (health === "ok" && (score < 7 || score > 8)) return false;
        if (health === "strong" && score < 9) return false;
      }
      if (activity !== "all") {
        if (!r.last_contact) return activity === "dormant";
        const days = (now - new Date(r.last_contact).getTime()) / (1000 * 60 * 60 * 24);
        if (activity === "week" && days > 7) return false;
        if (activity === "month" && (days <= 7 || days > 30)) return false;
        if (activity === "dormant" && days <= 30) return false;
      }
      if (hasPodcast === "yes" && !podcastIds.has(r.id)) return false;
      if (hasPodcast === "no" && podcastIds.has(r.id)) return false;
      return true;
    });
  }, [rows, search, rel, health, activity, hasPodcast, podcastIds]);

  // Score real: si ya existe scores.health lo respetamos; si no, derivamos
  // a partir de frecuencia (interacciones/wa_message_count) + recencia (last_contact).
  const computeScore = (r: Row): number => {
    if (typeof r.scores?.health === "number") return r.scores.health;
    let s = 5;
    if (r.last_contact) {
      const days = (Date.now() - new Date(r.last_contact).getTime()) / 86_400_000;
      if (days <= 7) s += 2;
      else if (days <= 30) s += 1;
      else if (days > 90) s -= 2;
      else if (days > 60) s -= 1;
    } else {
      s -= 1;
    }
    const msgs = r.wa_message_count || 0;
    if (msgs > 50) s += 2;
    else if (msgs > 10) s += 1;
    return Math.max(0, Math.min(10, s));
  };

  const cards = filtered.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    health_score: computeScore(r),
    last_topic: r.context,
    has_podcast: podcastIds.has(r.id),
    last_contact: r.last_contact,
  }));

  const hasActiveFilters =
    rel !== "all" || health !== "all" || activity !== "all" || hasPodcast !== "all" || search.trim() !== "";

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient glow */}
      <div className="absolute inset-x-0 top-0 h-[420px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 blur-[120px] rounded-full opacity-60" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-accent/10 blur-[100px] rounded-full opacity-40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* HERO */}
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80">
            <Sparkles className="w-3 h-3" />
            <span>Inteligencia relacional</span>
          </div>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            Tu red <span className="italic font-serif text-primary">estratégica</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Cada persona, cada conversación, cada oportunidad. Visualiza, prioriza y actúa
            con contexto completo de IA.
          </p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            label="Contactos"
            value={kpis.total}
            hint="vigilados"
            icon={<Users className="w-4 h-4" />}
            tone="primary"
          />
          <Kpi
            label="Activos 7d"
            value={kpis.activeWeek}
            hint="con actividad reciente"
            icon={<Activity className="w-4 h-4" />}
            tone="success"
          />
          <Kpi
            label="Críticos"
            value={kpis.critical}
            hint="requieren atención"
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="warning"
          />
          <Kpi
            label="Podcasts"
            value={kpis.podcasts}
            hint="relaciones audiables"
            icon={<Headphones className="w-4 h-4" />}
            tone="accent"
          />
        </div>

        {/* SEARCH + VIEW */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar contacto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-11 bg-card/40 backdrop-blur-xl border-border/60 focus:border-primary/50 rounded-full"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-card/40 backdrop-blur-xl border border-border/60">
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
              className="h-9 w-9 p-0 rounded-full"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
              className="h-9 w-9 p-0 rounded-full"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => setAddOpen(true)}
            className="h-11 rounded-full gap-2 px-4"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Añadir contacto</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshHeadlines}
            disabled={refreshing || rows.length === 0}
            className="h-11 rounded-full gap-2 px-4"
            title="Regenera el análisis de IA (salud, pendientes, temas) de los contactos de tu red"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">
              {refreshing ? "Actualizando…" : "Actualizar novedades"}
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshAllProfiles}
            disabled={refreshingAll || rows.length === 0}
            className="h-11 rounded-full gap-2 px-4 border-primary/40 text-primary hover:bg-primary/10"
            title="Reanaliza el perfil psicológico, emocional y de oportunidades de TODA tu red. Tarda varios minutos."
          >
            <Brain className={cn("w-4 h-4", refreshingAll && "animate-pulse")} />
            <span className="hidden sm:inline">
              {refreshingAll ? "Regenerando…" : "Regenerar perfiles"}
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={reimportMultimedia}
            disabled={reimporting}
            className="h-11 rounded-full gap-2 px-4"
            title="Re-importa los últimos 21 días desde Evolution para recuperar audios, imágenes y PDFs que se descartaron."
          >
            <Mic className={cn("w-4 h-4", reimporting && "animate-pulse")} />
            <span className="hidden sm:inline">
              {reimporting ? "Re-importando…" : "Re-importar multimedia"}
            </span>
          </Button>
        </div>

        {/* FILTER PILLS */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mr-1">Relación</span>
            <Pill active={rel === "all"} onClick={() => setRel("all")}>Todas</Pill>
            <Pill active={rel === "profesional"} onClick={() => setRel("profesional")}>Profesional</Pill>
            <Pill active={rel === "personal"} onClick={() => setRel("personal")}>Personal</Pill>
            <Pill active={rel === "familiar"} onClick={() => setRel("familiar")}>Familia</Pill>
            <Pill active={rel === "otro"} onClick={() => setRel("otro")}>Otro</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mr-1">Salud</span>
            <Pill active={health === "all"} onClick={() => setHealth("all")}>Toda</Pill>
            <Pill tone="warning" active={health === "critical"} onClick={() => setHealth("critical")}>Crítica</Pill>
            <Pill tone="warning" active={health === "attention"} onClick={() => setHealth("attention")}>Atención</Pill>
            <Pill tone="success" active={health === "ok"} onClick={() => setHealth("ok")}>Sana</Pill>
            <Pill tone="success" active={health === "strong"} onClick={() => setHealth("strong")}>Fuerte</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mr-1">Actividad</span>
            <Pill active={activity === "all"} onClick={() => setActivity("all")}>Toda</Pill>
            <Pill active={activity === "week"} onClick={() => setActivity("week")}>7 días</Pill>
            <Pill active={activity === "month"} onClick={() => setActivity("month")}>30 días</Pill>
            <Pill tone="warning" active={activity === "dormant"} onClick={() => setActivity("dormant")}>Dormidos</Pill>
            <span className="w-px h-4 bg-border/60 mx-1" />
            <Pill tone="primary" active={hasPodcast === "yes"} onClick={() => setHasPodcast(hasPodcast === "yes" ? "all" : "yes")}>
              <span className="flex items-center gap-1"><Headphones className="w-3 h-3" /> Con podcast</span>
            </Pill>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground font-mono">
                {cards.length} de {rows.length}
              </span>
              <button
                onClick={() => {
                  setSearch(""); setRel("all"); setHealth("all"); setActivity("all"); setHasPodcast("all");
                }}
                className="text-xs text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* BODY */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Cargando red…
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => navigate(`/red-estrategica/${c.id}`)}
                onRemove={() => removeFromNetwork(c.id, c.name)}
              />
            ))}
            {cards.length === 0 && (
              <div className="col-span-full">
                <GlassCard className="p-12 text-center space-y-4">
                  <Network className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  {rows.length === 0 ? (
                    <>
                      <div>
                        <p className="font-display text-lg">Tu red estratégica está vacía</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          Añade los contactos que quieres vigilar de cerca. Solo estos
                          aparecerán aquí y se actualizarán al pulsar "Actualizar novedades".
                        </p>
                      </div>
                      <Button onClick={() => setAddOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Añadir primer contacto
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Sin resultados con esos filtros.</p>
                  )}
                </GlassCard>
              </div>
            )}
          </div>
        ) : (
          <GlassCard className="overflow-hidden">
            <div className="divide-y divide-border/40">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/red-estrategica/${c.id}`)}
                  className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-primary/5 transition text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center text-xs font-semibold font-display group-hover:border-primary/50 transition">
                    {c.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate group-hover:text-primary transition">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {c.category || "—"} · salud {c.health_score}/10
                      {c.has_podcast && " · 🎧"}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      c.health_score >= 7 ? "bg-success" : c.health_score >= 4 ? "bg-warning" : "bg-destructive",
                    )}
                  />
                </button>
              ))}
              {cards.length === 0 && (
                <div className="text-center text-muted-foreground py-12">Sin resultados.</div>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      <AddToNetworkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        excludeIds={rows.map((r) => r.id)}
        onAdded={() => void load()}
      />
    </div>
  );
}
