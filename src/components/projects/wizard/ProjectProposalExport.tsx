import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { FileText, Loader2, Download, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProposalData {
  proposalMarkdown?: string;
  client_proposal_v1?: any;
  proposal_meta?: any;
  version?: number;
}

interface ProjectProposalExportProps {
  projectId: string;
  projectName: string;
  company: string;
  budgetStatus: "pending" | "generated" | "editing" | "approved";
  proposalData: ProposalData | null;
  proposalGenerating: boolean;
  onGenerate: () => Promise<any>;
}

/**
 * F7 Client Proposal — único entregable de cliente.
 *
 * - Llama a `project-wizard-step` con action `generate_client_proposal`.
 * - El backend deriva la propuesta desde Step 28 (scope) + commercial_terms_v1
 *   (que viene desde el frontend, derivado de budgetData).
 * - El PDF se renderiza pasando `proposal_markdown` (ya limpio) a la edge
 *   function `generate-document`. No usa los sanitizadores legacy 100/101/102.
 */
export const ProjectProposalExport = ({
  projectId,
  projectName,
  company,
  budgetStatus,
  proposalData,
  proposalGenerating,
  onGenerate,
}: ProjectProposalExportProps) => {
  const [downloading, setDownloading] = useState(false);

  const canGenerate = budgetStatus === "approved";
  const hasProposal = !!proposalData?.proposalMarkdown;
  const jargonWarnings: string[] =
    proposalData?.proposal_meta?.internal_jargon_warnings || [];

  const handleDownloadPdf = async () => {
    if (!proposalData?.proposalMarkdown) {
      toast.error("Genera la propuesta antes de descargar el PDF");
      return;
    }
    setDownloading(true);
    try {
      // Renderizamos el markdown YA LIMPIO por F7. generate-document solo
      // actúa como renderizador PDF — sin sanitizadores legacy de propuesta.
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          projectId,
          stepNumber: 30,
          content: proposalData.proposalMarkdown,
          contentType: "markdown",
          projectName: projectName || "Proyecto",
          company,
          date: new Date().toISOString().split("T")[0],
          version: `v${proposalData.version || 1}`,
          exportMode: "client",
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No download URL returned");
      const response = await fetch(data.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = data.fileName || `propuesta-${projectName || "proyecto"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Propuesta cliente descargada");
    } catch (err: any) {
      console.error("Proposal PDF download error:", err);
      toast.error("Error al generar PDF: " + (err.message || "Error desconocido"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <CollapsibleCard
      id="proposal-export"
      title="Paso 5 · Propuesta cliente"
      icon={<FileText className="w-4 h-4 text-primary" />}
      defaultOpen={true}
      badge={
        <Badge
          variant="outline"
          className="text-[10px] px-2 py-0 border-primary/30 text-primary bg-primary/5"
        >
          F7 · DOCUMENTO ÚNICO
        </Badge>
      }
    >
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Único entregable comercial. Se genera de forma determinista a partir
          del alcance aprobado y de las condiciones comerciales derivadas del
          presupuesto. No incluye margen, coste interno ni jerga técnica.
        </p>

        {!canGenerate && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-foreground/80">
              {budgetStatus === "editing"
                ? "Has editado el presupuesto. Apruébalo de nuevo para habilitar la propuesta."
                : budgetStatus === "generated"
                ? "Aprueba el presupuesto en el Paso 4 para poder generar la propuesta cliente."
                : "Genera y aprueba el presupuesto antes de generar la propuesta cliente."}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => onGenerate()}
            disabled={!canGenerate || proposalGenerating}
            className="gap-2 flex-1"
          >
            {proposalGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando propuesta...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {hasProposal ? "Regenerar propuesta cliente" : "Generar propuesta cliente"}
              </>
            )}
          </Button>

          <Button
            onClick={handleDownloadPdf}
            disabled={!hasProposal || downloading}
            variant="outline"
            className="gap-2 flex-1"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? "Generando PDF..." : "Descargar propuesta cliente PDF"}
          </Button>
        </div>

        {hasProposal && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Versión <strong className="text-foreground">v{proposalData?.version}</strong>
                {proposalData?.proposal_meta?.mvp_count != null && (
                  <> · MVP: <strong className="text-foreground">{proposalData.proposal_meta.mvp_count}</strong></>
                )}
                {proposalData?.proposal_meta?.fast_follow_count != null && (
                  <> · Fast-follow: <strong className="text-foreground">{proposalData.proposal_meta.fast_follow_count}</strong></>
                )}
              </span>
              {proposalData?.proposal_meta?.soul_required && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Soul sessions
                </Badge>
              )}
            </div>
            {jargonWarnings.length > 0 && (
              <p className="text-[11px] text-amber-600">
                ⚠️ Posible jerga interna detectada: {jargonWarnings.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
};
