import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, Plus, LayoutGrid, List, MessageSquare, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useProjectPipeline } from "@/hooks/useProjectPipeline";
import PipelineProgressView from "@/components/projects/PipelineProgressView";
import PipelineMiniIndicator from "@/components/projects/PipelineMiniIndicator";

const MATURITY_STATES = [
  { value: "seed", label: "🌱 Semilla", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "exploring", label: "🔍 Explorando", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "defining", label: "📐 Definiendo", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { value: "active", label: "🚀 En marcha", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "parked", label: "⏸️ Aparcado", color: "bg-muted text-muted-foreground border-border" },
  { value: "discarded", label: "❌ Descartado", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const CATEGORIES = [
  { value: "business", label: "Negocio" },
  { value: "tech", label: "Tecnología" },
  { value: "personal", label: "Personal" },
  { value: "family", label: "Familia" },
  { value: "investment", label: "Inversión" },
];

const KANBAN_COLUMNS = ["seed", "exploring", "defining", "active"];

export default function Projects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"simple" | "pipeline">("pipeline");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("business");
  const [pipelineIdea, setPipelineIdea] = useState("");

  const pipeline = useProjectPipeline();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["ideas-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideas_projects")
        .select("*")
        .order("interest_score", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch pipelines for mini indicators
  const { data: pipelines = [] } = useQuery({
    queryKey: ["project-pipelines", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pipelines")
        .select("id, project_id, status, current_step, idea_description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ideas_projects").insert({
        user_id: user!.id,
        name: newName,
        description: newDesc,
        category: newCategory,
        origin: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas-projects"] });
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      toast.success("Idea creada");
    },
    onError: () => toast.error("Error creando idea"),
  });

  const updateState = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const { error } = await supabase.from("ideas_projects").update({ maturity_state: state }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ideas-projects"] }),
  });

  const handleStartPipeline = async () => {
    if (!pipelineIdea.trim()) return;
    setCreateOpen(false);
    await pipeline.startPipeline(pipelineIdea.trim());
    setPipelineIdea("");
  };

  const getStateConfig = (state: string) => MATURITY_STATES.find(s => s.value === state) || MATURITY_STATES[0];

  // If viewing a pipeline, show the pipeline view
  if (pipeline.selectedPipelineId && pipeline.activePipeline) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <PipelineProgressView
          pipeline={pipeline.activePipeline}
          steps={pipeline.steps}
          isRunning={pipeline.isRunning}
          onBack={pipeline.closePipeline}
          onContinue={pipeline.continueToNextStep}
          onPause={pipeline.pausePipeline}
          onUpdateStep={pipeline.updateStepOutput}
        />
      </div>
    );
  }

  const ProjectCard = ({ project }: { project: any }) => {
    const stateConfig = getStateConfig(project.maturity_state);
    const projectPipeline = pipelines.find((p: any) => p.project_id === project.id);
    return (
      <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => projectPipeline && pipeline.selectPipeline(projectPipeline.id)}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-foreground">{project.name}</h3>
            <Badge variant="outline" className={`text-xs shrink-0 ${stateConfig.color}`}>
              {stateConfig.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {project.mention_count || 1}
            </span>
            {project.category && (
              <Badge variant="secondary" className="text-xs">{project.category}</Badge>
            )}
            {projectPipeline && (
              <PipelineMiniIndicator currentStep={projectPipeline.current_step} status={projectPipeline.status} />
            )}
          </div>
          {view === "list" && (
            <Select value={project.maturity_state} onValueChange={(v) => updateState.mutate({ id: project.id, state: v })}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATURITY_STATES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>
    );
  };

  // Pipeline cards (pipelines without project_id)
  const standalonePipelines = pipelines.filter((p: any) => !p.project_id);

  const PipelineCard = ({ p }: { p: any }) => (
    <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => pipeline.selectPipeline(p.id)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm text-foreground line-clamp-1">{p.idea_description}</h3>
          <Badge variant="outline" className="text-xs shrink-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            🌱 Pipeline
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <PipelineMiniIndicator currentStep={p.current_step} status={p.status} />
          <span>{p.status === "completed" ? "✅ Completado" : p.status === "error" ? "❌ Error" : `Paso ${p.current_step || 0}/4`}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-primary" />
            Proyectos e Ideas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ideas capturadas automáticamente desde transcripciones y notas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView("kanban")} className={`p-2 ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nueva idea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva idea o proyecto</DialogTitle></DialogHeader>
              <div className="flex gap-2 mb-3">
                <Button size="sm" variant={createMode === "pipeline" ? "default" : "outline"} onClick={() => setCreateMode("pipeline")} className="flex-1">
                  <Rocket className="w-3 h-3 mr-1" /> Pipeline IA
                </Button>
                <Button size="sm" variant={createMode === "simple" ? "default" : "outline"} onClick={() => setCreateMode("simple")} className="flex-1">
                  <Plus className="w-3 h-3 mr-1" /> Simple
                </Button>
              </div>

              {createMode === "pipeline" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Describe tu idea y 4 modelos de IA la analizarán: Claude (Arquitecto) → GPT-4 (Crítico) → Gemini (Visionario) → Claude (Consolidador)
                  </p>
                  <Textarea
                    placeholder="Describe tu idea en detalle: qué problema resuelve, para quién, cómo funciona..."
                    value={pipelineIdea}
                    onChange={e => setPipelineIdea(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <Button onClick={handleStartPipeline} disabled={!pipelineIdea.trim() || pipeline.isRunning} className="w-full">
                    <Rocket className="w-4 h-4 mr-1" /> Iniciar Pipeline
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input placeholder="Nombre de la idea" value={newName} onChange={e => setNewName(e.target.value)} />
                  <Textarea placeholder="Descripción" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => createMutation.mutate()} disabled={!newName.trim()} className="w-full">Crear idea</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Standalone Pipelines */}
      {standalonePipelines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Pipelines activos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {standalonePipelines.map((p: any) => <PipelineCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const stateConfig = getStateConfig(col);
            const items = projects.filter((p: any) => p.maturity_state === col);
            return (
              <div key={col} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">{stateConfig.label}</h3>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {items.map((p: any) => <ProjectCard key={p.id} project={p} />)}
                  {items.length === 0 && (
                    <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                      Sin ideas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p: any) => <ProjectCard key={p.id} project={p} />)}
          {projects.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay ideas aún. Procesa una transcripción o crea una manualmente.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
