import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PatternDetector } from "@/components/projects/PatternDetector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Plus, Loader2, Building2,
  Radar, Database, Wand2,
} from "lucide-react";
import RagArchitect from "./RagArchitect";

// Lazy import of useRagArchitect not needed — RagArchitect page is self-contained

interface WizardProject {
  id: string;
  name: string;
  company: string | null;
  status: string;
  current_step: number | null;
  estimated_value: number | null;
  created_at: string;
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

const statusConfig: Record<string, { label: string; className: string }> = {
  nuevo: { label: "Nuevo", className: "bg-blue-500/20 text-blue-400" },
  en_conversacion: { label: "En conversación", className: "bg-yellow-500/20 text-yellow-400" },
  propuesta_enviada: { label: "Propuesta", className: "bg-purple-500/20 text-purple-400" },
  negociacion: { label: "Negociación", className: "bg-orange-500/20 text-orange-400" },
  ganado: { label: "Ganado", className: "bg-green-500/20 text-green-400" },
  perdido: { label: "Perdido", className: "bg-red-500/20 text-red-400" },
  pausado: { label: "Pausado", className: "bg-muted text-muted-foreground" },
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
        .select("id, name, company, status, current_step, estimated_value, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WizardProject[];
    },
    enabled: !!user,
  });

  // Cost query per project (aggregate)
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

  const activeProjects = projects.filter(
    (p) => !["ganado", "perdido"].includes(p.status)
  );

  const sc = (status: string) => statusConfig[status] || statusConfig.nuevo;

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
        </div>
        <Button onClick={() => navigate("/projects/wizard/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Project List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <Wand2 className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">No tienes proyectos aún.</p>
            <Button onClick={() => navigate("/projects/wizard/new")} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Crear primer proyecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => {
            const step = p.current_step ?? 0;
            const cost = costs[p.id];
            const cfg = sc(p.status);
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => navigate(`/projects/wizard/${p.id}`)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                      {p.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {p.company}
                        </p>
                      )}
                    </div>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wand2 className="w-3 h-3" />
                      Paso {step}/9 — {stepLabels[step] || ""}
                    </span>
                    {cost != null && cost > 0 && (
                      <span className="font-mono text-primary">${cost.toFixed(4)}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(step / 9) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs: Detector + RAG */}
      <Tabs defaultValue="detector" className="mt-8">
        <TabsList>
          <TabsTrigger value="detector" className="gap-1.5">
            <Radar className="w-4 h-4" /> Detector de Patrones
          </TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5">
            <Database className="w-4 h-4" /> RAG Architect
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detector" className="mt-4 space-y-4">
          <Select value={detectorProjectId} onValueChange={setDetectorProjectId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Selecciona un proyecto" />
            </SelectTrigger>
            <SelectContent>
              {activeProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              {activeProjects.length === 0 && (
                <SelectItem value="_none" disabled>
                  No hay proyectos activos
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {detectorProjectId ? (
            <PatternDetector projectId={detectorProjectId} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Radar className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecciona un proyecto para analizar patrones
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rag" className="mt-4">
          <RagArchitect />
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default Projects;
