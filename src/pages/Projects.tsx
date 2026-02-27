import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Briefcase, Plus, Loader2, Building2,
  Wand2, ArrowRight,
  TrendingUp, FolderOpen, Clock,
} from "lucide-react";

interface WizardProject {
  id: string;
  name: string;
  company: string | null;
  status: string;
  current_step: number | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
}

const stepLabels: Record<number, string> = {
  0: "Sin iniciar",
  1: "Entrada",
  2: "Briefing",
  3: "Alcance",
  4: "Diagnóstico",
  5: "Recomendaciones",
  6: "Roadmap",
  7: "Propuesta",
  8: "Contrato",
  9: "Entrega",
};

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  nuevo:              { label: "Nuevo",           dot: "bg-blue-400",    bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  en_conversacion:    { label: "En conversación", dot: "bg-yellow-400",  bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  propuesta_enviada:  { label: "Propuesta",       dot: "bg-purple-400",  bg: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  negociacion:        { label: "Negociación",     dot: "bg-orange-400",  bg: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  ganado:             { label: "Ganado",           dot: "bg-green-400",   bg: "bg-green-500/10 text-green-400 border-green-500/20" },
  perdido:            { label: "Perdido",          dot: "bg-red-400",     bg: "bg-red-500/10 text-red-400 border-red-500/20" },
  pausado:            { label: "Pausado",          dot: "bg-muted-foreground", bg: "bg-muted text-muted-foreground border-border" },
};

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detectorProjectId, setDetectorProjectId] = useState<string>("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["business_projects_list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("business_projects")
        .select("id, name, company, status, current_step, estimated_value, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WizardProject[];
    },
    enabled: !!user,
  });

  const { data: costs = {} } = useQuery({
    queryKey: ["project_costs_summary", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from("project_costs")
        .select("project_id, cost_usd");
      if (error) return {};
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.project_id] = (map[r.project_id] || 0) + Number(r.cost_usd || 0);
      });
      return map;
    },
    enabled: !!user,
  });

  const activeProjects = projects.filter(p => !["ganado", "perdido"].includes(p.status));
  const totalValue = projects.reduce((s, p) => s + (p.estimated_value || 0), 0);
  const totalCost = Object.values(costs).reduce((s, c) => s + c, 0);

  const sc = (status: string) => statusConfig[status] || statusConfig.nuevo;

  return (
    <main className="p-4 lg:p-6 space-y-8">
      <Breadcrumbs />

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            Gestión de Proyectos
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 ml-[52px]">
            Pipeline completo con wizard de 9 pasos, detector de patrones y RAGs
          </p>
        </div>
        <Button 
          onClick={() => navigate("/projects/wizard/new")} 
          className="gap-2 shadow-lg shadow-primary/20 px-5"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Stats Strip */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                <p className="text-xs text-muted-foreground font-medium">Proyectos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeProjects.length}</p>
                <p className="text-xs text-muted-foreground font-medium">Activos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalValue > 0 ? `${(totalValue / 1000).toFixed(0)}k€` : "—"}
                </p>
                <p className="text-xs text-muted-foreground font-medium">Pipeline</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-mono">
                  {totalCost > 0 ? `$${totalCost.toFixed(2)}` : "$0"}
                </p>
                <p className="text-xs text-muted-foreground font-medium">Coste IA</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Project Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto">
              <Wand2 className="w-8 h-8 text-primary/40" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Sin proyectos aún</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea tu primer proyecto y sigue el wizard de 9 pasos para generar documentación completa.
              </p>
            </div>
            <Button onClick={() => navigate("/projects/wizard/new")} className="gap-2 mt-2">
              <Plus className="w-4 h-4" /> Crear primer proyecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const step = p.current_step ?? 0;
            const cost = costs[p.id];
            const cfg = sc(p.status);
            const progress = (step / 9) * 100;
            return (
              <Card
                key={p.id}
                className="group cursor-pointer border-border/50 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                onClick={() => navigate(`/projects/wizard/${p.id}`)}
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      {p.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Building2 className="w-3 h-3 shrink-0" /> {p.company}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`${cfg.bg} text-[11px] font-medium shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5`} />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Progress section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        Paso {step}/9 · {stepLabels[step] || ""}
                      </span>
                      <span className="text-muted-foreground font-mono">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground/70">
                      {format(new Date(p.updated_at || p.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                    <div className="flex items-center gap-3">
                      {cost != null && cost > 0 && (
                        <span className="text-[11px] font-mono text-primary/80">${cost.toFixed(4)}</span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </main>
  );
};

export default Projects;
