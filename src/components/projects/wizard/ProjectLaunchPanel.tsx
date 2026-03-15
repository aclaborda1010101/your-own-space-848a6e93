import { useState, useEffect } from "react";
import { Rocket, Sparkles, FileText, Pencil, Eye, Loader2 } from "lucide-react";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WizardStep {
  stepNumber: number;
  outputData: any;
  status: string;
  version?: number;
}

interface ProjectLaunchPanelProps {
  projectId: string;
  projectName: string;
  company?: string;
  steps?: WizardStep[];
}

export const ProjectLaunchPanel = ({
  projectId,
  projectName,
  company = "",
  steps = [],
}: ProjectLaunchPanelProps) => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  const [loading, setLoading] = useState(true);

  // Check if PRD (step 5) or at least scope (step 3) exists
  const hasPRD = steps.some(s => s.stepNumber === 5 && s.status === "completed");
  const hasScope = steps.some(s => s.stepNumber === 3 && (s.status === "completed" || s.status === "approved"));
  const canGenerate = hasPRD || hasScope;

  // Load existing step 200 on mount
  useEffect(() => {
    const loadExisting = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_wizard_steps")
        .select("output_data, status")
        .eq("project_id", projectId)
        .eq("step_number", 200)
        .maybeSingle();

      if (data?.output_data) {
        const content = typeof data.output_data === "string"
          ? data.output_data
          : JSON.stringify(data.output_data, null, 2);
        setMarkdown(content);
      }
      setLoading(false);
    };
    loadExisting();
  }, [projectId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-launch-strategy", {
        body: { projectId },
      });

      if (error) throw error;
      if (!data?.markdown) throw new Error("No se generó el documento");

      setMarkdown(data.markdown);
      toast.success("Estrategia de lanzamiento generada");
    } catch (err: any) {
      console.error("Launch strategy error:", err);
      toast.error("Error al generar: " + (err.message || "Error desconocido"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    setMarkdown(editBuffer);
    setEditing(false);

    // Persist edit
    await supabase
      .from("project_wizard_steps")
      .upsert(
        {
          project_id: projectId,
          step_number: 200,
          output_data: editBuffer,
          status: "completed",
        },
        { onConflict: "project_id,step_number" }
      );
    toast.success("Documento actualizado");
  };

  const startEdit = () => {
    setEditBuffer(markdown || "");
    setEditing(true);
  };

  return (
    <CollapsibleCard
      id="launch"
      title="Lanzamiento del Producto"
      icon={<Rocket className="w-4 h-4 text-primary" />}
      defaultOpen={false}
      badge={
        markdown ? (
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-green-500/30 text-green-600">
            Generado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/20 text-primary">
            Estrategia SaaS
          </Badge>
        )
      }
    >
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !markdown ? (
          /* Empty state */
          <div className="text-center space-y-4 py-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Rocket className="w-6 h-6 text-primary/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Estrategia de Lanzamiento SaaS
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Genera un documento estratégico completo que evalúa la viabilidad de lanzar este proyecto como un SaaS escalable: ICP, competencia, pricing, GTM, crecimiento y roadmap comercial.
              </p>
            </div>
            {!canGenerate && (
              <p className="text-xs text-amber-600">
                Completa al menos el Alcance (F3) o PRD (F5) para generar la estrategia.
              </p>
            )}
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando estrategia...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Estrategia de Lanzamiento
                </>
              )}
            </Button>
          </div>
        ) : editing ? (
          /* Edit mode */
          <div className="space-y-3">
            <Textarea
              value={editBuffer}
              onChange={(e) => setEditBuffer(e.target.value)}
              className="min-h-[400px] font-mono text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                Guardar cambios
              </Button>
            </div>
          </div>
        ) : (
          /* View mode with tabs */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-1.5"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Regenerar
                </Button>
              </div>
              <ProjectDocumentDownload
                projectId={projectId}
                stepNumber={200}
                content={markdown}
                contentType="markdown"
                projectName={projectName}
                company={company}
                label="PDF"
              />
            </div>

            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="h-8">
                <TabsTrigger value="preview" className="text-xs gap-1.5">
                  <Eye className="w-3 h-3" />
                  Vista previa
                </TabsTrigger>
                <TabsTrigger value="raw" className="text-xs gap-1.5">
                  <FileText className="w-3 h-3" />
                  Markdown
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-4 max-h-[600px] overflow-y-auto bg-background">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdown}
                  </ReactMarkdown>
                </div>
              </TabsContent>
              <TabsContent value="raw">
                <pre className="text-xs font-mono whitespace-pre-wrap border rounded-lg p-4 max-h-[600px] overflow-y-auto bg-muted/30">
                  {markdown}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
};
