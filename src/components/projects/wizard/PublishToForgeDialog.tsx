import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Rocket, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PublishToForgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  prdText?: string;
}

export function PublishToForgeDialog({
  open, onOpenChange, projectId, projectName, projectDescription, prdText,
}: PublishToForgeDialogProps) {
  const [documentText, setDocumentText] = useState(prdText || "");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const PROGRESS_STAGES = [
    { at: 5, label: "Preparando documento..." },
    { at: 15, label: "Enviando a Expert Forge..." },
    { at: 30, label: "Analizando estructura del PRD..." },
    { at: 50, label: "Generando RAGs y especialistas..." },
    { at: 70, label: "Configurando reglas MoE..." },
    { at: 85, label: "Validando sistema experto..." },
    { at: 95, label: "Finalizando..." },
  ];

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startProgress = () => {
    setProgress(0);
    setProgressLabel(PROGRESS_STAGES[0].label);
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 3 + 0.5;
      if (current > 95) current = 95;
      setProgress(Math.round(current));
      const stage = [...PROGRESS_STAGES].reverse().find(s => current >= s.at);
      if (stage) setProgressLabel(stage.label);
    }, 800);
  };

  const stopProgress = (success: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (success) {
      setProgress(100);
      setProgressLabel("¡Completado!");
    }
  };

  const handlePublish = async () => {
    if (!documentText.trim()) {
      toast.error("Falta el PRD canónico");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    startProgress();

    try {
      const { data, error: fnError } = await supabase.functions.invoke("publish-to-forge", {
        body: {
          project_id: projectId,
          project_name: projectName,
          project_description: projectDescription || "",
          document_text: documentText,
          source_of_truth: "PRD_CANONICAL",
          mode: "LITERAL",
          rewrite: "FORBIDDEN",
          inference_layer: "DISABLED",
          extraction_metadata: "EXCLUDED",
          architecture_alternatives: "EXCLUDED",
          scope: "ONLY_CANONICAL_PRD",
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      stopProgress(true);
      setResult(data.result);
      toast.success("PRD enviado a Expert Forge exitosamente");
    } catch (e: any) {
      console.error("[PublishToForge] Error:", e);
      stopProgress(false);
      setError(e.message || "Error desconocido");
      toast.error("Error al publicar en Expert Forge");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Publicar en Expert Forge
          </DialogTitle>
          <DialogDescription>
            Envía únicamente el <strong>PRD técnico canónico literal</strong> de <strong>{projectName}</strong>, sin resumen, sin reinterpretación y sin bloques auxiliares.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                PRD técnico canónico
              </label>
              <Textarea
                value={documentText}
                onChange={e => setDocumentText(e.target.value)}
                placeholder="PRD canónico literal, sin briefing, sin extracción, sin MVP y sin metadata auxiliar..."
                rows={10}
                className="text-xs font-mono"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {documentText.length.toLocaleString()} caracteres · SOURCE_OF_TRUTH: PRD_CANONICAL
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {progressLabel}
                  </span>
                  <span className="font-mono">{progress}%</span>
                </div>
              </div>
            )}

            <Button onClick={handlePublish} disabled={loading || !documentText.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Publicando...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Analizar y Publicar
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Expert Forge ha procesado el PRD</span>
            </div>

            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              {result.rags_count != null && <p>📚 RAGs creados: <strong>{result.rags_count}</strong></p>}
              {result.specialists_count != null && <p>🧠 Especialistas: <strong>{result.specialists_count}</strong></p>}
              {result.moe_rules_count != null && <p>⚙️ Reglas MoE: <strong>{result.moe_rules_count}</strong></p>}
              {!result.rags_count && !result.specialists_count && (
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>

            {result.project_url && (
              <Button variant="outline" className="w-full" onClick={() => window.open(result.project_url, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver en Expert Forge
              </Button>
            )}

            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
