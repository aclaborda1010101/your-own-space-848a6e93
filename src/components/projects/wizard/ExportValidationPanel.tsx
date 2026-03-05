import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Lock, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";

interface Props {
  projectId: string;
  stepNumber: number;
  content: any;
  contentType: "markdown" | "json";
  projectName: string;
  company?: string;
  version: number;
  exportMode: "client" | "internal";
  onExportModeChange: (mode: "client" | "internal") => void;
}

interface ValidationWarning {
  type: string;
  key: string;
  message: string;
}

interface ValidationResult {
  canExport: boolean;
  pendingTags: string[];
  needsClarification: string[];
  hasNotaMvp: boolean;
  dedupApplied: boolean;
  issues: string[];
  warnings?: ValidationWarning[];
  score?: number;
  scoreBreakdown?: { CRIT: number; IMP: number; MEN: number; NO_APLICA: number };
}

export const ExportValidationPanel = ({
  projectId,
  stepNumber,
  content,
  contentType,
  projectName,
  company,
  version,
  exportMode,
  onExportModeChange,
}: Props) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [allowDraft, setAllowDraft] = useState(false);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);

  const handleExportModeChange = (mode: "client" | "internal") => {
    onExportModeChange(mode);
    setValidation(null);
    setAllowDraft(false); // Reset draft on mode change
  };

  const runValidation = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          projectId,
          stepNumber,
          content,
          contentType,
          projectName,
          company,
          date: new Date().toISOString().split("T")[0],
          version: `v${version}`,
          exportMode,
          validateOnly: true,
          auditJson: (stepNumber === 4 || stepNumber === 5) ? content : undefined,
        },
      });
      if (error) throw error;
      setValidation(data.validation);
    } catch (e: any) {
      toast.error("Error al validar: " + e.message);
    } finally {
      setValidating(false);
    }
  };

  const handleDraftToggle = (checked: boolean) => {
    if (checked) {
      setShowDraftConfirm(true);
    } else {
      setAllowDraft(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 75) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (score >= 60) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excelente";
    if (score >= 75) return "Bueno";
    if (score >= 60) return "Mejorable";
    return "Requiere atención";
  };

  const hasPending = validation ? validation.pendingTags.length > 0 : false;

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Validación antes de exportar
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
                <Button
                  size="sm"
                  variant={exportMode === "client" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => handleExportModeChange("client")}
                >
                  Cliente
                </Button>
                <Button
                  size="sm"
                  variant={exportMode === "internal" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => handleExportModeChange("internal")}
                >
                  Interno
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={runValidation}
            disabled={validating}
          >
            {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {validating ? "Validando..." : "Ejecutar validación"}
          </Button>

          {validation && (
            <div className="space-y-2">
              {/* Score breakdown (only for steps 4/5 with audit data) */}
              {validation.score !== undefined && validation.scoreBreakdown && (
                <div className={`rounded-lg border p-3 ${getScoreColor(validation.score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">Puntuación Global</span>
                    <span className="text-lg font-bold">{validation.score}/100</span>
                  </div>
                  <div className="text-xs font-medium mb-2">{getScoreLabel(validation.score)}</div>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    <div className="text-center">
                      <div className="font-bold text-red-600">{validation.scoreBreakdown.CRIT}</div>
                      <div className="text-muted-foreground">Críticos</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-orange-600">{validation.scoreBreakdown.IMP}</div>
                      <div className="text-muted-foreground">Importantes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-yellow-600">{validation.scoreBreakdown.MEN}</div>
                      <div className="text-muted-foreground">Menores</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-muted-foreground">{validation.scoreBreakdown.NO_APLICA}</div>
                      <div className="text-muted-foreground">N/A</div>
                    </div>
                  </div>
                </div>
              )}

              {/* PENDING tags */}
              <CheckItem
                label="PENDING resueltos"
                ok={validation.pendingTags.length === 0}
                detail={validation.pendingTags.length > 0
                  ? `${validation.pendingTags.length} pendiente(s): ${validation.pendingTags.slice(0, 3).join(", ")}${validation.pendingTags.length > 3 ? "..." : ""}`
                  : undefined
                }
              />

              {/* NEEDS_CLARIFICATION */}
              <CheckItem
                label="Clarificaciones resueltas"
                ok={validation.needsClarification.length === 0}
                detail={validation.needsClarification.length > 0
                  ? `${validation.needsClarification.length} por clarificar`
                  : undefined
                }
              />

              {/* NOTA MVP */}
              <CheckItem
                label="NOTA MVP presente"
                ok={validation.hasNotaMvp}
                detail={!validation.hasNotaMvp ? "No se encontró NOTA MVP en el documento" : undefined}
              />

              {/* Dedup */}
              <CheckItem label="Deduplicación aplicada" ok={validation.dedupApplied} />

              {/* Non-blocking warnings */}
              {validation.warnings && validation.warnings.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {validation.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{w.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Draft toggle (only in client mode) */}
              {exportMode === "client" && hasPending && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Switch
                    id="allow-draft"
                    checked={allowDraft}
                    onCheckedChange={handleDraftToggle}
                  />
                  <Label htmlFor="allow-draft" className="text-xs cursor-pointer">
                    Permitir borrador con campos pendientes
                  </Label>
                </div>
              )}

              {/* Export buttons */}
              <div className="pt-2 space-y-2">
                {exportMode === "client" && !hasPending && (
                  /* Cliente FINAL — no pending tags */
                  <ProjectDocumentDownload
                    projectId={projectId}
                    stepNumber={stepNumber}
                    content={contentType === "markdown"
                      ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                      : content
                    }
                    contentType={contentType}
                    projectName={projectName}
                    company={company}
                    version={version}
                    exportMode="client"
                    size="default"
                    label="Exportar Cliente (FINAL)"
                    auditJson={(stepNumber === 4 || stepNumber === 5) ? content : undefined}
                  />
                )}

                {exportMode === "client" && hasPending && !allowDraft && (
                  <Alert variant="destructive" className="mt-1">
                    <Lock className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Export Cliente FINAL bloqueado: hay campos [[PENDING]] sin resolver. Activa "Permitir borrador" o exporta en modo Interno.
                    </AlertDescription>
                  </Alert>
                )}

                {exportMode === "client" && hasPending && allowDraft && (
                  /* Cliente BORRADOR — with draft watermark */
                  <ProjectDocumentDownload
                    projectId={projectId}
                    stepNumber={stepNumber}
                    content={contentType === "markdown"
                      ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                      : content
                    }
                    contentType={contentType}
                    projectName={projectName}
                    company={company}
                    version={version}
                    exportMode="client"
                    allowDraft={true}
                    size="default"
                    variant="outline"
                    label="Exportar Cliente (BORRADOR)"
                    auditJson={(stepNumber === 4 || stepNumber === 5) ? content : undefined}
                  />
                )}

                {exportMode === "internal" && (
                  /* Interno — always available */
                  <ProjectDocumentDownload
                    projectId={projectId}
                    stepNumber={stepNumber}
                    content={contentType === "markdown"
                      ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                      : content
                    }
                    contentType={contentType}
                    projectName={projectName}
                    company={company}
                    version={version}
                    exportMode="internal"
                    size="default"
                    label="Exportar Interno"
                    auditJson={(stepNumber === 4 || stepNumber === 5) ? content : undefined}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Draft confirmation dialog */}
      <AlertDialog open={showDraftConfirm} onOpenChange={setShowDraftConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Permitir exportar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              El documento se exportará con campos pendientes sin resolver. Incluirá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Watermark "BORRADOR PARA REVISIÓN — NO ENVIAR" en cada página</li>
                <li>Badge de borrador en la portada</li>
                <li>Nombre de archivo con sufijo __CLIENTE_BORRADOR__</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDraftConfirm(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAllowDraft(true);
              setShowDraftConfirm(false);
            }}>
              Sí, permitir borrador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const CheckItem = ({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) => (
  <div className="flex items-start gap-2 text-xs">
    {ok ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
    ) : (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
    )}
    <div>
      <span className={ok ? "text-muted-foreground" : "text-foreground font-medium"}>{label}</span>
      {detail && <p className="text-muted-foreground mt-0.5">{detail}</p>}
    </div>
  </div>
);
