import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Check, FileText, AlertTriangle, RefreshCw, Brain, Radar, Cloud, Pencil, Save, X, Users, Lock, Upload, Trash2, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";
import { ExportValidationPanel } from "./ExportValidationPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,.xlsx,.csv,.json,.mp3,.wav,.m4a";

interface AttachmentFile {
  name: string;
  path: string;
  size: number;
}

const StepAttachmentsPanel = ({
  projectId,
  stepNumber,
  onFilesChanged,
}: {
  projectId: string;
  stepNumber: number;
  onFilesChanged: (files: AttachmentFile[]) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const newFiles: AttachmentFile[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path = `${projectId}/step${stepNumber}_attachments/${safeName}`;
        const { error } = await supabase.storage
          .from("project-documents")
          .upload(path, file, { upsert: true });
        if (error) {
          toast.error(`Error subiendo ${file.name}`);
          continue;
        }
        newFiles.push({ name: file.name, path, size: file.size });
      }
      if (newFiles.length > 0) {
        const updated = [...files, ...newFiles];
        setFiles(updated);
        onFilesChanged(updated);
        toast.success(`${newFiles.length} archivo(s) adjuntado(s)`);
      }
    } catch {
      toast.error("Error subiendo archivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onFilesChanged(updated);
  };

  return (
    <div className="border rounded-lg border-border/50 bg-muted/10">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5" />
          Adjuntar archivos adicionales
          {files.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{files.length}</Badge>
          )}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Seleccionar archivos
          </Button>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-xs">
                  <span className="truncate flex-1">{f.name}</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeFile(i)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Los archivos se incluirán como contexto adicional al regenerar.
          </p>
        </div>
      )}
    </div>
  );
};

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
  exportMode?: "client" | "internal";
  onExportModeChange?: (mode: "client" | "internal") => void;
  status?: string;
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
  exportMode,
  onExportModeChange,
  status,
}: Props) => {
  const hasOutput = outputData !== null && outputData !== undefined;
  const isApproved = status === "approved";
  const [locked, setLocked] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [stepAttachments, setStepAttachments] = useState<AttachmentFile[]>([]);

  const startEditing = () => {
    if (isMarkdown) {
      const text = typeof outputData === "string" ? outputData : outputData?.document || JSON.stringify(outputData, null, 2);
      setEditedContent(text);
    } else {
      setEditedContent(JSON.stringify(outputData, null, 2));
    }
    setEditing(true);
  };

  const saveEdits = async () => {
    try {
      let parsed: any;
      if (isMarkdown) {
        parsed = typeof outputData === "string" ? editedContent : { ...outputData, document: editedContent };
      } else {
        parsed = JSON.parse(editedContent);
      }
      if (onUpdateOutputData) {
        await onUpdateOutputData(parsed);
      }
      setEditing(false);
      toast.success("Cambios guardados");
    } catch (e) {
      toast.error("JSON inválido. Revisa el formato.");
    }
  };

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
          <div className="flex items-center gap-2">
            {/* B5: Client/Internal toggle for step 5 */}
            {stepNumber === 5 && hasOutput && onExportModeChange && (
              <div className="flex items-center gap-2 mr-3 border rounded-lg px-3 py-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Modo:</span>
                <Button
                  size="sm"
                  variant={exportMode === "client" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => onExportModeChange("client")}
                >
                  Cliente
                </Button>
                <Button
                  size="sm"
                  variant={exportMode === "internal" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => onExportModeChange("internal")}
                >
                  Interno
                </Button>
              </div>
            )}
            {hasOutput && (
              isApproved ? (
                <Badge className="bg-green-600/15 text-green-600 border border-green-600/30 gap-1">
                  <Check className="w-3 h-3" />
                  Aprobado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  Generado
                </Badge>
              )
            )}
          </div>
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
            {editing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[500px] font-mono text-xs"
              />
            ) : stepNumber === 3 && isMarkdown && outputData?.lovable_build_prd ? (
              <Tabs defaultValue="full" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="full" className="text-xs">PRD Completo</TabsTrigger>
                  <TabsTrigger value="lovable" className="text-xs">Lovable Build PRD</TabsTrigger>
                  <TabsTrigger value="forge" className="text-xs">Expert Forge Spec</TabsTrigger>
                </TabsList>
                <TabsContent value="full">
                  <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {outputData?.document || JSON.stringify(outputData, null, 2)}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="lovable">
                  <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {outputData.lovable_build_prd}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="forge">
                  <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {outputData.expert_forge_spec || "No disponible. Regenera el PRD para obtener el Expert Forge Spec."}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
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
            )}

            {/* Attachments panel for regeneration */}
            {projectId && !editing && (
              <StepAttachmentsPanel
                projectId={projectId}
                stepNumber={stepNumber}
                onFilesChanged={setStepAttachments}
              />
            )}

            {editing ? (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditing(false)} className="gap-2 flex-1">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
                <Button onClick={saveEdits} className="gap-2 flex-1">
                  <Save className="w-4 h-4" />
                  Guardar cambios
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={onGenerate} className="gap-2 flex-1">
                  <Play className="w-4 h-4" />
                  Regenerar
                  {stepAttachments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">+{stepAttachments.length} archivos</Badge>
                  )}
                </Button>
                <Button variant="outline" onClick={startEditing} className="gap-2 flex-1">
                  <Pencil className="w-4 h-4" />
                  Editar
                </Button>
                {projectId && stepNumber !== 5 && (
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
                    exportMode={exportMode || "client"}
                  />
                )}
                <Button onClick={onApprove} className="gap-2 flex-1">
                  <Check className="w-4 h-4" />
                  Aprobar y continuar
                </Button>
              </div>
            )}

            {/* Export Validation Panel for step 5 */}
            {stepNumber === 5 && projectId && hasOutput && onExportModeChange && (
              <ExportValidationPanel
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
                exportMode={exportMode || "client"}
                onExportModeChange={onExportModeChange}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
