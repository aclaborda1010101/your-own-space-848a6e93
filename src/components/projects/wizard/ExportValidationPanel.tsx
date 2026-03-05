import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Lock } from "lucide-react";
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

interface ValidationResult {
  canExport: boolean;
  pendingTags: string[];
  needsClarification: string[];
  hasNotaMvp: boolean;
  dedupApplied: boolean;
  issues: string[];
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

  return (
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
                onClick={() => { onExportModeChange("client"); setValidation(null); }}
              >
                Cliente
              </Button>
              <Button
                size="sm"
                variant={exportMode === "internal" ? "default" : "ghost"}
                className="h-6 text-xs px-2"
                onClick={() => { onExportModeChange("internal"); setValidation(null); }}
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

            {/* Export button or block */}
            {exportMode === "client" && !validation.canExport ? (
              <Alert variant="destructive" className="mt-3">
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Export Cliente bloqueado: hay campos [[PENDING]] sin resolver. Resuélvelos o exporta en modo Interno.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="pt-2">
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
                  exportMode={exportMode}
                  size="default"
                  label={exportMode === "client" ? "Exportar Cliente" : "Exportar Interno"}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
