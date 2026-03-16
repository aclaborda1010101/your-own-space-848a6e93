import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, Database, Brain, Link2, Settings } from "lucide-react";
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

// Persisted forge status in project_wizard_steps step_number=300
interface ForgeStatus {
  state: "idle" | "publishing" | "done" | "error";
  result?: ForgeResult;
  error?: string;
  started_at?: string;
}

const FORGE_STEP_NUMBER = 300;
const POLL_INTERVAL_MS = 3000;

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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wasPublished, setWasPublished] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Track mount status
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // On open: check persisted forge status
  useEffect(() => {
    if (open && projectId) {
      checkPersistedStatus();
      runVerify(true);
    }
    return () => stopPolling();
  }, [open, projectId]);

  const PROGRESS_STAGES = [
    { at: 5, label: "Creando proyecto en Expert Forge..." },
    { at: 20, label: "Proyecto creado, enviando PRD al arquitecto..." },
    { at: 35, label: "Analizando componentes IA del PRD..." },
    { at: 50, label: "Clasificando especialistas y motores..." },
    { at: 65, label: "Provisionando RAGs y especialistas..." },
    { at: 80, label: "Configurando reglas MoE..." },
    { at: 90, label: "Ejecutando validaciones V01-V08..." },
    { at: 95, label: "Finalizando arquitectura..." },
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

  // ── Persisted status helpers ──

  const readForgeStatus = useCallback(async (): Promise<ForgeStatus | null> => {
    try {
      const { data, error: queryError } = await (supabase as any)
        .from("project_wizard_steps")
        .select("output_data")
        .eq("project_id", projectId)
        .eq("step_number", FORGE_STEP_NUMBER)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      if (!queryError && data?.output_data) {
        return data.output_data as ForgeStatus;
      }
    } catch {
      // No persisted status
    }
    return null;
  }, [projectId]);

  const writeForgeStatus = useCallback(async (status: ForgeStatus) => {
    try {
      await supabase
        .from("project_wizard_steps" as any)
        .upsert({
          project_id: projectId,
          step_number: FORGE_STEP_NUMBER,
          step_name: "Expert Forge Publish",
          status: status.state === "done" ? "approved" : status.state === "error" ? "draft" : "in_review",
          output_data: status as any,
          version: 1,
        }, { onConflict: "project_id,step_number,version" });
    } catch (e) {
      console.warn("[PublishToForge] Failed to persist status:", e);
    }
  }, [projectId]);

  const checkPersistedStatus = useCallback(async () => {
    const status = await readForgeStatus();
    if (!status) return;

    if (status.state === "done" && status.result) {
      setResult(status.result);
      setWasPublished(true);
      setLoading(false);
      console.log("[PublishToForge] Recovered completed result from DB");
    } else if (status.state === "publishing") {
      // A publish was started but we navigated away — start polling
      const startedAt = status.started_at ? new Date(status.started_at).getTime() : 0;
      const elapsed = Date.now() - startedAt;
      // If started less than 5 min ago, assume still running
      if (elapsed < 5 * 60 * 1000) {
        setLoading(true);
        startProgress();
        startPolling();
        console.log("[PublishToForge] Resuming poll for in-flight publish");
      } else {
        // Stale — mark as error
        await writeForgeStatus({ state: "error", error: "Publicación expirada (>5 min sin respuesta)" });
        setError("La publicación anterior expiró. Inténtalo de nuevo.");
      }
    } else if (status.state === "error" && status.error) {
      setError(status.error);
    }
  }, [readForgeStatus, writeForgeStatus]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const status = await readForgeStatus();
      if (!status) return;
      if (status.state === "done" && status.result) {
        stopPolling();
        if (mountedRef.current) {
          stopProgress(true);
          setResult(status.result);
          setWasPublished(true);
          setLoading(false);
          toast.success("Proyecto arquitecturado en Expert Forge");
          setTimeout(() => runVerify(), 2000);
        }
      } else if (status.state === "error") {
        stopPolling();
        if (mountedRef.current) {
          stopProgress(false);
          setError(status.error || "Error desconocido");
          setLoading(false);
          toast.error("Error al publicar en Expert Forge");
        }
      }
    }, POLL_INTERVAL_MS);
  }, [readForgeStatus]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ── Verify ──

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

  // ── Publish ──

  const handlePublish = async () => {
    if (!prdText?.trim()) {
      toast.error("No hay PRD disponible para arquitecturar");
      return;
    }
    if (prdText.trim().length < 1000) {
      toast.error(`PRD demasiado corto (${prdText.trim().length} chars). Regenera el Paso 3.`);
      return;
    }
    console.log(`[PublishToForge] Sending PRD: ${prdText.length} chars`);

    setLoading(true);
    setError(null);
    setResult(null);
    setVerifyData(null);
    startProgress();

    // Mark as publishing in DB so we can recover if user navigates away
    await writeForgeStatus({ state: "publishing", started_at: new Date().toISOString() });

    // Start polling immediately — if user navigates away, the edge function
    // will persist the result and polling on re-open will pick it up
    startPolling();

    try {
      const payload = {
        action: "create_and_architect",
        project_id: projectId,
        project_name: projectName,
        project_description: projectDescription || "",
        document_text: prdText,
        auto_provision: true,
      };

      const { data, error: fnError } = await supabase.functions.invoke("publish-to-forge", {
        body: payload,
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const forgeResult = data.result || data;

      // Persist success to DB
      await writeForgeStatus({ state: "done", result: forgeResult });

      stopPolling();

      if (mountedRef.current) {
        stopProgress(true);
        setResult(forgeResult);
        setWasPublished(true);
        toast.success("Proyecto arquitecturado en Expert Forge");
        setTimeout(() => runVerify(), 2000);
      }
    } catch (e: unknown) {
      console.error("[PublishToForge] Error:", e);
      const msg = e instanceof Error ? e.message : "Error desconocido";

      // Persist error to DB
      await writeForgeStatus({ state: "error", error: msg });

      stopPolling();

      if (mountedRef.current) {
        stopProgress(false);
        setError(msg);
        toast.error("Error al publicar en Expert Forge");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // When dialog closes while publishing, show a toast so user knows it continues
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && loading) {
      toast.info("La publicación en Expert Forge continúa en segundo plano. Vuelve a abrir para ver el resultado.");
    }
    onOpenChange(newOpen);
  };

  const report = result?.provisioned_report;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            {wasPublished ? "Re-arquitecturar en Expert Forge" : "Publicar en Expert Forge"}
          </DialogTitle>
          <DialogDescription>
            {wasPublished ? "Re-arquitectura" : "Crea el proyecto en"} Expert Forge y provisiona automáticamente RAGs, especialistas y routers a partir del PRD de <strong>{projectName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {!loading && !error && (
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
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  Puedes cerrar esta ventana — la publicación continuará en segundo plano.
                </p>
              </div>
            )}

            <Button
              onClick={handlePublish}
              disabled={loading || !prdText?.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creando y arquitecturando...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  {wasPublished ? "Re-arquitecturar" : "Publicar en Expert Forge"}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Proyecto arquitecturado en Expert Forge</span>
            </div>

            {result.truncated && (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>El PRD superó los 400K caracteres y fue cortado. Las secciones finales no se procesaron.</span>
              </div>
            )}

            {report ? (
              <div className="space-y-3">
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
              <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                {result.rags_count != null && <p>📚 RAGs creados: <strong>{result.rags_count}</strong></p>}
                {result.specialists_count != null && <p>🧠 Especialistas: <strong>{result.specialists_count}</strong></p>}
                {result.moe_rules_count != null && <p>⚙️ Reglas MoE: <strong>{result.moe_rules_count}</strong></p>}
                {!result.rags_count && !result.specialists_count && (
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                )}
              </div>
            )}

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
