import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Rocket, ExternalLink, CheckCircle2, AlertTriangle, Cpu, RefreshCw, Database, Brain, Link2, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProvisionedReport {
  rags_created?: string[];
  rags_reused?: string[];
  specialists_created?: string[];
  specialists_reused?: string[];
  links_created?: string[];
  links_skipped?: string[];
  components_classification?: { name: string; class: string }[];
  router_id?: string;
}

interface ForgeResult {
  architecture?: Record<string, unknown>;
  provisioned?: boolean;
  provisioned_report?: ProvisionedReport;
  truncated?: boolean;
  rags_count?: number;
  specialists_count?: number;
  moe_rules_count?: number;
  project_url?: string;
}

interface VerifyResult {
  rags?: { name?: string; id?: string }[];
  specialists?: { name?: string; id?: string; model?: string }[];
}

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
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wasPublished, setWasPublished] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (prdText) setDocumentText(prdText);
  }, [prdText]);

  // Check if project was already published when dialog opens
  useEffect(() => {
    if (open && projectId && autoMode) {
      runVerify(true);
    }
  }, [open, projectId, autoMode]);

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

  const runVerify = async (silent = false) => {
    try {
      if (!silent) setVerifying(true);
      const { data, error: fnError } = await supabase.functions.invoke("publish-to-forge", {
        body: { action: "verify", project_id: projectId, project_name: projectName },
      });
      if (!fnError && data?.success) {
        setVerifyData({ rags: data.rags, specialists: data.specialists });
        const hasData = (Array.isArray(data.rags) && data.rags.length > 0) ||
                        (Array.isArray(data.specialists) && data.specialists.length > 0);
        if (hasData) setWasPublished(true);
      }
    } catch (e) {
      console.warn("[PublishToForge] Verify failed:", e);
    } finally {
      if (!silent) setVerifying(false);
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
    setVerifyData(null);
    startProgress();

    try {
      const payload: Record<string, string | boolean> = {
        project_id: projectId,
        project_name: projectName,
        project_description: projectDescription || "",
        document_text: text,
      };

      if (autoMode) {
        payload.action = "create_and_architect";
      } else {
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
      const forgeResult = data.result || data;
      setResult(forgeResult);
      setWasPublished(true);
      toast.success(autoMode
        ? "Proyecto creado y arquitecturado en Expert Forge"
        : "BUILD_SLICE F0+F1 enviado a Expert Forge exitosamente"
      );

      // Auto-verify after success
      setTimeout(() => runVerify(), 2000);
    } catch (e: unknown) {
      console.error("[PublishToForge] Error:", e);
      stopProgress(false);
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      toast.error(autoMode
        ? "Error al arquitecturar en Expert Forge"
        : "Error al publicar en Expert Forge"
      );
    } finally {
      setLoading(false);
    }
  };

  const report = result?.provisioned_report;
  const title = autoMode
    ? (wasPublished ? "Re-arquitecturar en Expert Forge" : "Arquitecturar en Expert Forge")
    : "Publicar en Expert Forge";
  const Icon = autoMode ? Cpu : Rocket;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {autoMode ? (
              <>
                {wasPublished ? "Re-arquitectura" : "Crea el proyecto en"} Expert Forge y provisiona automáticamente RAGs, especialistas y routers a partir del PRD de <strong>{projectName}</strong>.
              </>
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
                {wasPublished && (
                  <p className="text-xs text-primary mt-2 font-medium">
                    ⚡ Este proyecto ya existe en Expert Forge. Se re-arquitecturará (componentes similares &gt;80% se reutilizan).
                  </p>
                )}
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
                  {autoMode
                    ? (wasPublished ? "Re-arquitecturar" : "Crear y Arquitecturar")
                    : "Enviar BUILD_SLICE F0+F1"
                  }
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

            {/* Truncated warning */}
            {result.truncated && (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>El PRD superó los 400K caracteres y fue cortado. Las secciones finales no se procesaron.</span>
              </div>
            )}

            {/* Provisioned report details */}
            {report ? (
              <div className="space-y-3">
                {/* RAGs */}
                {((report.rags_created?.length || 0) > 0 || (report.rags_reused?.length || 0) > 0) && (
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Database className="h-4 w-4" /> RAGs
                    </div>
                    {report.rags_created?.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-5">✅ {r}</p>
                    ))}
                    {report.rags_reused?.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-5">♻️ {r} (reutilizado)</p>
                    ))}
                  </div>
                )}

                {/* Specialists */}
                {((report.specialists_created?.length || 0) > 0 || (report.specialists_reused?.length || 0) > 0) && (
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Brain className="h-4 w-4" /> Especialistas
                    </div>
                    {report.specialists_created?.map((s, i) => {
                      const classification = report.components_classification?.find(c => c.name === s);
                      return (
                        <p key={i} className="text-xs text-muted-foreground ml-5">
                          ✅ {s}
                          {classification && (
                            <span className="ml-1 text-primary/70">({classification.class})</span>
                          )}
                        </p>
                      );
                    })}
                    {report.specialists_reused?.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-5">♻️ {s} (reutilizado)</p>
                    ))}
                  </div>
                )}

                {/* Links */}
                {((report.links_created?.length || 0) > 0 || (report.links_skipped?.length || 0) > 0) && (
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Link2 className="h-4 w-4" /> Links
                    </div>
                    {report.links_created?.map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-5">🔗 {l}</p>
                    ))}
                    {report.links_skipped?.map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-5 opacity-60">⏭️ {l}</p>
                    ))}
                  </div>
                )}

                {/* Router */}
                {report.router_id && (
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Settings className="h-4 w-4" /> Router MoE
                    </div>
                    <p className="text-xs text-muted-foreground ml-5 font-mono">{report.router_id}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: simple counts */
              <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                {result.rags_count != null && <p>📚 RAGs creados: <strong>{result.rags_count}</strong></p>}
                {result.specialists_count != null && <p>🧠 Especialistas: <strong>{result.specialists_count}</strong></p>}
                {result.moe_rules_count != null && <p>⚙️ Reglas MoE: <strong>{result.moe_rules_count}</strong></p>}
                {!result.rags_count && !result.specialists_count && (
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                )}
              </div>
            )}

            {/* Verified data from gateway */}
            {verifyData && (
              <div className="bg-primary/5 rounded-lg p-3 text-sm space-y-1 border border-primary/10">
                <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Verificación en Expert Forge
                </div>
                {Array.isArray(verifyData.rags) && verifyData.rags.length > 0 && (
                  <p className="text-xs text-muted-foreground ml-5">
                    📚 {verifyData.rags.length} RAG{verifyData.rags.length !== 1 ? 's' : ''} confirmados
                  </p>
                )}
                {Array.isArray(verifyData.specialists) && verifyData.specialists.length > 0 && (
                  <p className="text-xs text-muted-foreground ml-5">
                    🧠 {verifyData.specialists.length} especialista{verifyData.specialists.length !== 1 ? 's' : ''} confirmados
                  </p>
                )}
              </div>
            )}

            {verifying && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando en Expert Forge...
              </p>
            )}

            <div className="flex gap-2">
              {result.project_url && (
                <Button variant="outline" className="flex-1" onClick={() => window.open(result.project_url, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en Expert Forge
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => runVerify()} disabled={verifying}>
                <RefreshCw className={`h-4 w-4 ${verifying ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
