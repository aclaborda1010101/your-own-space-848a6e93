import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Rocket, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
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

  const handlePublish = async () => {
    if (!documentText.trim()) {
      toast.error("Pega o sube el texto del PRD primero");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("publish-to-forge", {
        body: {
          project_id: projectId,
          project_name: projectName,
          project_description: projectDescription || "",
          document_text: documentText,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult(data.result);
      toast.success("PRD enviado a Expert Forge exitosamente");
    } catch (e: any) {
      console.error("[PublishToForge] Error:", e);
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
            Envía el documento completo de <strong>{projectName}</strong> (briefing, alcance, auditoría, PRD y MVP) para auto-generar el sistema experto (RAGs + especialistas + MoE).
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Documento completo del proyecto
              </label>
              <Textarea
                value={documentText}
                onChange={e => setDocumentText(e.target.value)}
                placeholder="Documento completo: briefing, alcance, auditoría IA, PRD técnico y MVP..."
                rows={10}
                className="text-xs font-mono"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {documentText.length.toLocaleString()} caracteres
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={handlePublish} disabled={loading || !documentText.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando a Expert Forge...
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
