import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Check, FileText, AlertTriangle, RefreshCw, Brain, Radar, Cloud } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";

interface Props {
  stepNumber: number;
  stepName: string;
  description: string;
  outputData: any;
  generating: boolean;
  onGenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  generateLabel?: string;
  isMarkdown?: boolean;
  projectId?: string;
  projectName?: string;
  company?: string;
  version?: number;
  onUpdateOutputData?: (updatedData: any) => void;
}

const ServicesDecisionPanel = ({ outputData, onUpdateOutputData }: { outputData: any; onUpdateOutputData?: (d: any) => void }) => {
  const sd = outputData?.services_decision;
  if (!sd) return null;

  const toggleService = (service: "rag" | "pattern_detector") => {
    if (!onUpdateOutputData) return;
    const updated = {
      ...outputData,
      services_decision: {
        ...sd,
        [service]: {
          ...sd[service],
          necesario: !sd[service]?.necesario,
          override: true,
        },
      },
    };
    onUpdateOutputData(updated);
  };

  const toggleDeployment = () => {
    if (!onUpdateOutputData) return;
    const updated = {
      ...outputData,
      services_decision: {
        ...sd,
        deployment_mode: sd.deployment_mode === "SAAS" ? "SELF_HOSTED" : "SAAS",
      },
    };
    onUpdateOutputData(updated);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Servicios Recomendados</span>
        </div>

        {/* RAG */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">RAG</span>
                {sd.rag?.necesario ? (
                  <Badge variant="default" className="text-[10px]">
                    {sd.rag?.override ? "Forzado" : `Confianza: ${Math.round((sd.rag?.confianza || 0) * 100)}%`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">No recomendado</Badge>
                )}
              </div>
              {sd.rag?.justificación && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sd.rag.justificación}</p>
              )}
            </div>
          </div>
          <Switch checked={!!sd.rag?.necesario} onCheckedChange={() => toggleService("rag")} />
        </div>

        {/* Pattern Detector */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Radar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Detector de Patrones</span>
                {sd.pattern_detector?.necesario ? (
                  <Badge variant="default" className="text-[10px]">
                    {sd.pattern_detector?.override ? "Forzado" : `Confianza: ${Math.round((sd.pattern_detector?.confianza || 0) * 100)}%`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">No recomendado</Badge>
                )}
              </div>
              {sd.pattern_detector?.justificación && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sd.pattern_detector.justificación}</p>
              )}
            </div>
          </div>
          <Switch checked={!!sd.pattern_detector?.necesario} onCheckedChange={() => toggleService("pattern_detector")} />
        </div>

        {/* Deployment mode */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">Modo despliegue</span>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={toggleDeployment}>
            {sd.deployment_mode === "SAAS" ? "SaaS" : "Self-Hosted"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ProjectWizardGenericStep = ({
  stepNumber,
  stepName,
  description,
  outputData,
  generating,
  onGenerate,
  onApprove,
  generateLabel = "Generar",
  isMarkdown = false,
  projectId,
  projectName,
  company,
  version = 1,
  onUpdateOutputData,
}: Props) => {
  const hasOutput = outputData !== null && outputData !== undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{stepNumber}</span>
            </div>
            <div>
              <CardTitle className="text-lg">{stepName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          {hasOutput && (
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              Generado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate button */}
        {!hasOutput && !generating && (
          <Button onClick={onGenerate} className="gap-2 w-full">
            <Play className="w-4 h-4" />
            {generateLabel}
          </Button>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generando {stepName.toLowerCase()}...</p>
          </div>
        )}

        {/* Parse error display */}
        {hasOutput && !generating && outputData?.parse_error && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Extracción interrumpida</AlertTitle>
              <AlertDescription>
                La generación se truncó antes de completarse. El modelo no pudo generar el JSON completo. Pulsa reintentar para volver a generar.
              </AlertDescription>
            </Alert>
            <ScrollArea className="h-[200px] rounded-lg border border-border/50 bg-muted/20 p-4">
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                {outputData?.raw_text?.substring(0, 2000) || "Sin datos"}...
              </pre>
            </ScrollArea>
            <Button onClick={onGenerate} className="gap-2 w-full" variant="destructive">
              <RefreshCw className="w-4 h-4" />
              Reintentar extracción
            </Button>
          </div>
        )}

        {/* Output display */}
        {hasOutput && !generating && !outputData?.parse_error && (
          <>
            {/* Services Decision panel for Step 6 */}
            {stepNumber === 6 && outputData?.services_decision && (
              <ServicesDecisionPanel outputData={outputData} onUpdateOutputData={onUpdateOutputData} />
            )}
            <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/20 p-4">
              {isMarkdown ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {typeof outputData === "string" ? outputData : outputData?.document || JSON.stringify(outputData, null, 2)}
                </div>
              ) : (
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                  {typeof outputData === "string" ? outputData : JSON.stringify(outputData, null, 2)}
                </pre>
              )}
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onGenerate} className="gap-2 flex-1">
                <Play className="w-4 h-4" />
                Regenerar
              </Button>
              {projectId && (
                <ProjectDocumentDownload
                  projectId={projectId}
                  stepNumber={stepNumber}
                  content={isMarkdown
                    ? (typeof outputData === "string" ? outputData : outputData?.document || JSON.stringify(outputData, null, 2))
                    : outputData
                  }
                  contentType={isMarkdown ? "markdown" : "json"}
                  projectName={projectName || ""}
                  company={company}
                  version={version}
                />
              )}
              <Button onClick={onApprove} className="gap-2 flex-1">
                <Check className="w-4 h-4" />
                Aprobar y continuar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
