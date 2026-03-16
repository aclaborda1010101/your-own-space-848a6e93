import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Rocket, ExternalLink, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
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
  autoMode?: boolean;
}

export function PublishToForgeDialog({
  open, onOpenChange, projectId, projectName, projectDescription, prdText, autoMode = false,
}: PublishToForgeDialogProps) {
  const [documentText, setDocumentText] = useState(prdText || "");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update documentText when prdText changes (especially for autoMode)
  useEffect(() => {
    if (prdText) setDocumentText(prdText);
  }, [prdText]);

  const PROGRESS_STAGES_PUBLISH = [
    { at: 5, label: "Preparando BUILD_SLICE_F0_F1..." },
    { at: 15, label: "Enviando contrato limpio a Expert Forge..." },
    { at: 30, label: "Validando consistencia de nombres..." },
    { at: 50, label: "Generando RAGs y especialistas (solo F0+F1)..." },
    { at: 70, label: "Configurando reglas MoE..." },
    { at: 85, label: "Validando sistema experto..." },
    { at: 95, label: "Finalizando..." },
  ];

  const PROGRESS_STAGES_ARCHITECT = [
    { at: 5, label: "Creando proyecto en Expert Forge..." },
    { at: 20, label: "Proyecto creado, enviando PRD al arquitecto..." },
    { at: 35, label: "Analizando componentes IA del PRD..." },
    { at: 50, label: "Clasificando especialistas y motores..." },
    { at: 65, label: "Provisionando RAGs y especialistas..." },
    { at: 80, label: "Configurando reglas MoE..." },
    { at: 90, label: "Ejecutando validaciones V01-V08..." },
    { at: 95, label: "Finalizando arquitectura..." },
  ];

  const stages = autoMode ? PROGRESS_STAGES_ARCHITECT : PROGRESS_STAGES_PUBLISH;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startProgress = () => {
    setProgress(0);
    setProgressLabel(stages[0].label);
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 3 + 0.5;
      if (current > 95) current = 95;
      setProgress(Math.round(current));
      const stage = [...stages].reverse().find(s => current >= s.at);
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
    const text = autoMode ? (prdText || documentText) : documentText;
    if (!text.trim()) {
      toast.error(autoMode ? "No hay PRD disponible para arquitecturar" : "Falta el BUILD_SLICE para Fase 0 + Fase 1");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    startProgress();

    try {
      const payload: Record<string, string> = {
        project_id: projectId,
        project_name: projectName,
        project_description: projectDescription || "",
        document_text: text,
      };

      if (autoMode) {
        payload.action = "create_and_architect";
      } else {
        // Strict build-slice contract
        payload.build_mode = "STRICT";
        payload.source_of_truth = "BUILD_SLICE_F0_F1";
        payload.mode = "LITERAL";
        payload.rewrite = "FORBIDDEN";
        payload.inference_layer = "DISABLED";
        payload.extraction_metadata = "EXCLUDED";
        payload.architecture_alternatives = "EXCLUDED";
        payload.scope = "ONLY_BUILD_SLICE_F0_F1";
        payload.full_prd = "EXCLUDED";
        payload.future_phases = "EXCLUDED";
        payload.duplicate_naming = "FORBIDDEN";
        payload.alternate_roles = "FORBIDDEN";
        payload.alternate_states = "FORBIDDEN";
        payload.undefined_tables_or_queries = "FORBIDDEN";
      }

      const { data, error: fnError } = await supabase.functions.invoke("publish-to-forge", {
        body: payload,
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      stopProgress(true);
      setResult(data.result || data);
      toast.success(autoMode
        ? "Proyecto creado y arquitecturado en Expert Forge"
        : "BUILD_SLICE F0+F1 enviado a Expert Forge exitosamente"
      );
    } catch (e: any) {
      console.error("[PublishToForge] Error:", e);
      stopProgress(false);
      setError(e.message || "Error desconocido");
      toast.error(autoMode
        ? "Error al arquitecturar en Expert Forge"
        : "Error al publicar en Expert Forge"
      );
    } finally {
      setLoading(false);
    }
  };

  const title = autoMode ? "Arquitecturar en Expert Forge" : "Publicar en Expert Forge";
  const Icon = autoMode ? Cpu : Rocket;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {autoMode ? (
              <>Crea el proyecto en Expert Forge y provisiona automáticamente RAGs, especialistas y routers a partir del PRD de <strong>{projectName}</strong>.</>
            ) : (
              <>Envía únicamente el <strong>BUILD_SLICE F0+F1</strong> de <strong>{projectName}</strong>. Sin PRD completo, sin fases futuras, sin duplicados de nombres ni roles alternativos.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {!autoMode && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  BUILD_SLICE F0 + F1 (contrato de implementación)
                </label>
                <Textarea
                  value={documentText}
                  onChange={e => setDocumentText(e.target.value)}
                  placeholder="Pega aquí únicamente el bloque BUILD_SLICE_F0_F1. Sin PRD completo, sin glosario, sin fases futuras..."
                  rows={10}
                  className="text-xs font-mono"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {documentText.length.toLocaleString()} caracteres · BUILD_MODE: STRICT · SOURCE: BUILD_SLICE_F0_F1
                </p>
              </div>
            )}

            {autoMode && !loading && !error && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
                <p>Se enviará el PRD completo ({(prdText?.length || 0).toLocaleString()} chars) para:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Crear proyecto en Expert Forge</li>
                  <li>Extraer e instanciar componentes IA del PRD</li>
                  <li>Provisionar RAGs, especialistas y routers</li>
                  <li>Ejecutar validaciones V01-V08</li>
                </ul>
              </div>
            )}

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

            <Button
              onClick={handlePublish}
              disabled={loading || (!autoMode && !documentText.trim())}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {autoMode ? "Creando y arquitecturando..." : "Publicando BUILD_SLICE..."}
                </>
              ) : (
                <>
                  <Icon className="h-4 w-4 mr-2" />
                  {autoMode ? "Crear y Arquitecturar" : "Enviar BUILD_SLICE F0+F1"}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                {autoMode ? "Proyecto arquitecturado en Expert Forge" : "Expert Forge ha procesado el BUILD_SLICE"}
              </span>
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
