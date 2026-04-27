import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Package } from "lucide-react";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepInfo {
  stepNumber: number;
  outputData: any;
  status: string;
  version: number;
}

interface Props {
  projectId: string;
  projectName: string;
  company?: string;
  steps: StepInfo[];
}

const STEP_NAMES: Record<number, string> = {
  2: "Briefing Extraído",
  3: "Documento de Alcance",
  4: "Auditoría Cruzada",
  5: "Documento Final",
  6: "Auditoría IA",
  7: "PRD Técnico",
  8: "Generación de RAGs",
  9: "Detección de Patrones",
  32: "Lovable Build Pack",
};

const STEP_CONTENT_TYPE: Record<number, "markdown" | "json"> = {
  2: "json", 3: "markdown", 4: "json", 5: "markdown",
  6: "json", 7: "markdown", 8: "json", 9: "json",
  32: "markdown",
};

const statusLabel = (status: string) => {
  if (status === "approved") return <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px]">Aprobado</Badge>;
  if (status === "review") return <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">En revisión</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">Pendiente</Badge>;
};

export const ProjectDocumentsPanel = ({ projectId, projectName, company, steps }: Props) => {
  const [downloadingAll, setDownloadingAll] = useState(false);

  const availableSteps = steps.filter(s =>
    s.stepNumber >= 2 && s.outputData && !s.outputData?.parse_error
  );

  if (availableSteps.length === 0) return null;

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      let count = 0;

      for (const step of availableSteps) {
        try {
          const content = STEP_CONTENT_TYPE[step.stepNumber] === "markdown"
            ? (typeof step.outputData === "string" ? step.outputData : step.outputData?.document || JSON.stringify(step.outputData, null, 2))
            : step.outputData;

          const { data, error } = await supabase.functions.invoke("generate-document", {
            body: {
              projectId,
              stepNumber: step.stepNumber,
              content,
              contentType: STEP_CONTENT_TYPE[step.stepNumber],
              projectName,
              company: company || "",
              date: new Date().toISOString().split("T")[0],
              version: `v${step.version}`,
            },
          });

          if (error || !data?.url) continue;

          const res = await fetch(data.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const fileName = data.fileName || `fase-${step.stepNumber}.pdf`;
          zip.file(fileName, blob);
          count++;
        } catch {
          // Skip failed individual docs
        }
      }

      if (count === 0) {
        toast.error("No se pudo generar ningún documento");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-documentos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${count} documentos descargados en ZIP`);
    } catch (err: any) {
      toast.error("Error al generar ZIP: " + (err.message || "Error"));
    } finally {
      setDownloadingAll(false);
    }
  };

  const getStepContent = (step: StepInfo) => {
    const ct = STEP_CONTENT_TYPE[step.stepNumber];
    if (ct === "markdown") {
      return typeof step.outputData === "string" ? step.outputData : step.outputData?.document || JSON.stringify(step.outputData, null, 2);
    }
    return step.outputData;
  };

  return (
    <CollapsibleCard
      id="project-documents"
      title="Documentos del proyecto"
      icon={<FileText className="w-4 h-4 text-primary" />}
      badge={<Badge variant="secondary" className="text-[10px]">{availableSteps.length}</Badge>}
      defaultOpen={false}
    >
      <div className="p-4">
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="gap-1.5"
          >
            {downloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            {downloadingAll ? "Generando..." : "Descargar todo (ZIP)"}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs w-16">Fase</TableHead>
              <TableHead className="text-xs w-16">Versión</TableHead>
              <TableHead className="text-xs w-24">Estado</TableHead>
              <TableHead className="text-xs w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {availableSteps.map(step => (
              <TableRow key={step.stepNumber}>
                <TableCell className="text-sm font-medium">{STEP_NAMES[step.stepNumber] || `Fase ${step.stepNumber}`}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{step.stepNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">v{step.version}</TableCell>
                <TableCell>{statusLabel(step.status)}</TableCell>
                <TableCell className="text-right">
                  <ProjectDocumentDownload
                    projectId={projectId}
                    stepNumber={step.stepNumber}
                    content={getStepContent(step)}
                    contentType={STEP_CONTENT_TYPE[step.stepNumber]}
                    projectName={projectName}
                    company={company}
                    version={step.version}
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CollapsibleCard>
  );
};
