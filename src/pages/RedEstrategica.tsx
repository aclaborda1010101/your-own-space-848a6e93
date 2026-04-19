import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ContactCard } from "@/components/contact/ContactCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Search, LayoutGrid, List, Network } from "lucide-react";

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

type ViewMode = "cards" | "list" | "map";
type RelFilter = "all" | "profesional" | "personal" | "familiar" | "otro";
type HealthFilter = "all" | "critical" | "attention" | "ok" | "strong";
type ActivityFilter = "all" | "week" | "month" | "dormant";

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

  const cards = filtered.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    health_score: r.scores?.health ?? 5,
    last_topic: r.context,
    has_podcast: podcastIds.has(r.id),
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero */}
        <div className="space-y-2">
          <h1 className="font-display font-semibold text-3xl sm:text-4xl tracking-tight">
            Tu red estratégica
          </h1>
          <p className="text-muted-foreground">
            <span className="font-mono text-foreground">{rows.length}</span> contactos
            {" · "}
            <span className="font-mono text-foreground">{cards.length}</span> mostrados
            {" · "}
            <span className="font-mono text-primary">{podcastIds.size}</span> con podcast
          </p>
        </div>

        {/* Filters bar */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={rel} onValueChange={(v) => setRel(v as RelFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Relación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda relación</SelectItem>
                <SelectItem value="profesional">Profesional</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="familiar">Familia</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={health} onValueChange={(v) => setHealth(v as HealthFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Salud" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda salud</SelectItem>
                <SelectItem value="critical">Crítica (&lt;4)</SelectItem>
                <SelectItem value="attention">Atención (4-6)</SelectItem>
                <SelectItem value="ok">Sana (7-8)</SelectItem>
                <SelectItem value="strong">Fuerte (9-10)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activity} onValueChange={(v) => setActivity(v as ActivityFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Actividad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda actividad</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="dormant">Dormidos &gt;30d</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasPodcast} onValueChange={(v) => setHasPodcast(v as "all" | "yes" | "no")}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Podcast" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="yes">Con podcast</SelectItem>
                <SelectItem value="no">Sin podcast</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 ml-auto p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <Button size="sm" variant={view === "cards" ? "default" : "ghost"} onClick={() => setView("cards")} className="h-8 w-8 p-0">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} className="h-8 w-8 p-0">
                <List className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={view === "map" ? "default" : "ghost"} onClick={() => setView("map")} className="h-8 w-8 p-0">
                <Network className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Cargando red…
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <ContactCard key={c.id} contact={c} onClick={() => navigate(`/red-estrategica/${c.id}`)} />
            ))}
            {cards.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                Sin resultados con esos filtros.
              </div>
            )}
          </div>
        ) : view === "list" ? (
          <GlassCard className="overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/red-estrategica/${c.id}`)}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-semibold font-display">
                    {c.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.category || "—"} · Salud {c.health_score}/10
                      {c.has_podcast && " · 🎧"}
                    </div>
                  </div>
                </button>
              ))}
              {cards.length === 0 && (
                <div className="text-center text-muted-foreground py-12">Sin resultados.</div>
              )}
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-12 text-center">
            <Network className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-display font-semibold text-lg mb-1">Mapa de red</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Visualización gráfica de tu red próximamente. Por ahora usa Tarjetas o Lista densa.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
