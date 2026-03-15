import { useState, useEffect } from "react";
import { Target, Sparkles, Loader2, Eye, FileText, RefreshCw } from "lucide-react";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ProjectSaaSEvaluationPanelProps {
  projectId: string;
  projectName: string;
  company?: string;
}

export const ProjectSaaSEvaluationPanel = ({
  projectId,
  projectName,
  company = "",
}: ProjectSaaSEvaluationPanelProps) => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [label, setLabel] = useState<string>("low");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExisting = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_wizard_steps")
        .select("output_data, status")
        .eq("project_id", projectId)
        .eq("step_number", 201)
        .maybeSingle();

      if (data?.output_data) {
        try {
          const parsed = typeof data.output_data === "string"
            ? JSON.parse(data.output_data)
            : data.output_data;
          setMarkdown(parsed.markdown || null);
          setScore(parsed.score || 0);
          setLabel(parsed.label || "low");
        } catch {
          const content = typeof data.output_data === "string" ? data.output_data : JSON.stringify(data.output_data);
          setMarkdown(content);
        }
      }
      setLoading(false);
    };
    loadExisting();
  }, [projectId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-saas-opportunity`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ projectId }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(errBody || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data?.markdown) throw new Error("No se generó la evaluación");

      setMarkdown(data.markdown);
      setScore(data.score || 0);
      setLabel(data.label || "low");
      toast.success("Evaluación SaaS generada");
    } catch (err: any) {
      console.error("SaaS evaluation error:", err);
      const msg = err.name === "AbortError"
        ? "Timeout: la generación tardó demasiado"
        : (err.message || "Error desconocido");
      toast.error("Error al generar: " + msg);
    } finally {
      setGenerating(false);
    }
  };

  const labelConfig = {
    high: { emoji: "🟢", text: "High SaaS Potential", color: "border-green-500/30 text-green-600 bg-green-500/5" },
    medium: { emoji: "🟡", text: "Medium Potential", color: "border-amber-500/30 text-amber-600 bg-amber-500/5" },
    low: { emoji: "🔴", text: "Low Potential", color: "border-red-500/30 text-red-600 bg-red-500/5" },
  };

  const currentLabel = labelConfig[label as keyof typeof labelConfig] || labelConfig.low;

  const scoreColor = score >= 65
    ? "text-green-500"
    : score >= 50
      ? "text-amber-500"
      : "text-red-500";

  const scoreRingColor = score >= 65
    ? "stroke-green-500"
    : score >= 50
      ? "stroke-amber-500"
      : "stroke-red-500";

  return (
    <CollapsibleCard
      id="saas-evaluation"
      title="Evaluación de Oportunidad SaaS"
      icon={<Target className="w-4 h-4 text-primary" />}
      defaultOpen={false}
      badge={
        markdown ? (
          <Badge variant="outline" className={cn("text-[10px] px-2 py-0", currentLabel.color)}>
            {currentLabel.emoji} {currentLabel.text}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/20 text-primary">
            Scoring
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
              <Target className="w-6 h-6 text-primary/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Evaluación de Oportunidad SaaS
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Análisis objetivo y crítico de la probabilidad de éxito del proyecto como SaaS escalable. Incluye scoring, evaluación por factores, fortalezas, riesgos y recomendación estratégica.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evaluando oportunidad...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Evaluar Oportunidad SaaS
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Results */
          <div className="space-y-4">
            {/* Score Hero */}
            <div className="flex items-center gap-6 p-4 rounded-xl border border-border/50 bg-muted/20">
              {/* Circular score */}
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-muted/30"
                  />
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                    className={scoreRingColor}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn("text-xl font-bold", scoreColor)}>{score}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">Opportunity Score</p>
                <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5", currentLabel.color)}>
                  {currentLabel.emoji} {currentLabel.text}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {score >= 80 ? "Oportunidad muy fuerte para escalar como SaaS" :
                   score >= 65 ? "Buena oportunidad con fundamentos sólidos" :
                   score >= 50 ? "Oportunidad moderada, requiere validación" :
                   score >= 35 ? "Oportunidad débil, considerar alternativas" :
                   "No recomendable como SaaS en su estado actual"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
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
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Reevaluar
              </Button>
              <ProjectDocumentDownload
                projectId={projectId}
                stepNumber={201}
                content={markdown}
                contentType="markdown"
                projectName={projectName}
                company={company}
                label="PDF"
              />
            </div>

            {/* Content tabs */}
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
