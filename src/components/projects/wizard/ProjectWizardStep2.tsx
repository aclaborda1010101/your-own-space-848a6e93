import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, RefreshCw, Check, AlertTriangle, Sparkles,
  ChevronDown, FileText, Target, Users, Zap, ShieldAlert,
  CheckCircle2, HelpCircle, BarChart3, Plug, Gauge,
  ListChecks, XCircle, Eye, Pencil, Upload, Trash2, Paperclip,
  Layers, Lightbulb, Lock, CircleHelp, Cpu, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  inputContent: string;
  briefing: any;
  generating: boolean;
  onExtract: () => void;
  onForceFullExtract?: () => void;
  onChunkedReExtract?: () => void;
  onApprove: (editedBriefing: any) => void;
  projectId?: string;
  projectName?: string;
  company?: string;
  version?: number;
}

const priorityColor = (p: string) => {
  const v = (p || "").toUpperCase();
  if (v === "P0" || v === "CRÍTICA") return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "P1" || v === "ALTA") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
};

const levelBadge = (value: string | undefined, type: "complexity" | "urgency" | "confidence") => {
  if (!value) return null;
  const v = value.toLowerCase();
  let color = "bg-muted text-muted-foreground";
  if (type === "complexity") {
    if (v.includes("alt")) color = "bg-destructive/15 text-destructive";
    else if (v.includes("medi")) color = "bg-amber-500/15 text-amber-600";
    else color = "bg-emerald-500/15 text-emerald-600";
  } else if (type === "urgency") {
    if (v.includes("alt") || v.includes("crít")) color = "bg-destructive/15 text-destructive";
    else if (v.includes("medi")) color = "bg-amber-500/15 text-amber-600";
    else color = "bg-emerald-500/15 text-emerald-600";
  } else {
    if (v.includes("alt")) color = "bg-emerald-500/15 text-emerald-600";
    else if (v.includes("medi")) color = "bg-amber-500/15 text-amber-600";
    else color = "bg-destructive/15 text-destructive";
  }
  return <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", color)}>{value}</span>;
};

export interface AttachmentMeta {
  name: string;
  path: string;
  size: number;
  type: string;
}

const ACCEPTED_TYPES = ".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const certaintyColor = (c: string) => {
  if (c === "high") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (c === "medium") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
};

const layerLabel: Record<string, string> = {
  business: "Negocio", knowledge: "Conocimiento", execution: "Ejecución",
  deterministic: "Determinista", orchestration: "Orquestación",
  integration: "Integración", presentation: "Presentación",
};

const componentTypeLabel: Record<string, string> = {
  none: "", knowledge_asset: "Knowledge", ai_specialist: "Especialista IA",
  workflow_module: "Workflow", deterministic_engine: "Motor Det.",
  orchestrator: "Orquestador", dashboard: "Dashboard",
  connector: "Conector", analytics_module: "Analítica",
};

const BriefItemList = ({ items, colorScheme, showComponentType }: {
  items: any[]; colorScheme: string; showComponentType?: boolean;
}) => {
  const bgMap: Record<string, string> = {
    emerald: "bg-emerald-500/5 border-emerald-500/10",
    blue: "bg-blue-500/5 border-blue-500/10",
    violet: "bg-violet-500/5 border-violet-500/10",
    red: "bg-destructive/5 border-destructive/10",
    amber: "bg-amber-500/5 border-amber-500/10",
    cyan: "bg-cyan-500/5 border-cyan-500/10",
  };
  const bg = bgMap[colorScheme] || "bg-muted/20 border-border/30";

  return (
    <div className="space-y-2">
      {items.map((item: any, i: number) => {
        const title = item.title || item.titulo || (typeof item === "string" ? item : "");
        const desc = item.description || item.descripcion || "";
        const certainty = item.certainty;
        const abstraction = item.abstraction_level;
        const layer = item.likely_layer;
        const compType = item.candidate_component_type;
        const evidence = item.evidence_snippets;
        const blockedBy = item.blocked_by;
        const downstream = item.downstream_impact;

        return (
          <div key={item.id || i} className={cn("p-3 rounded-lg border", bg)}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground/90 flex-1">{title}</p>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                {certainty && (
                  <Badge className={cn("text-[10px] h-5 border", certaintyColor(certainty))}>{certainty}</Badge>
                )}
                {abstraction && abstraction !== "observed" && (
                  <Badge variant="outline" className="text-[10px] h-5">{abstraction}</Badge>
                )}
              </div>
            </div>
            {desc && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {layer && layer !== "business" && (
                <Badge variant="secondary" className="text-[10px] h-5">{layerLabel[layer] || layer}</Badge>
              )}
              {showComponentType && compType && compType !== "none" && (
                <Badge variant="outline" className="text-[10px] h-5 border-dashed">{componentTypeLabel[compType] || compType}</Badge>
              )}
              {blockedBy && (
                <span className="text-[10px] text-amber-600">⚡ Bloqueado: {blockedBy}</span>
              )}
            </div>
            {downstream && <p className="text-[10px] text-muted-foreground mt-1">↓ Impacto: {downstream}</p>}
            {evidence && Array.isArray(evidence) && evidence.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground mt-1.5 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3" /> {evidence.length} evidencia(s)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1.5 space-y-1 pl-3 border-l-2 border-border/30">
                    {evidence.map((e: string, j: number) => (
                      <p key={j} className="text-[11px] text-muted-foreground/80 italic leading-relaxed">"{e}"</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ProjectWizardStep2 = ({ inputContent, briefing, generating, onExtract, onForceFullExtract, onApprove, projectId, projectName, company, version = 1 }: Props) => {
  const [editedBriefing, setEditedBriefing] = useState<any>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (briefing) {
      // Recover from parse_error: try to parse raw_text
      if (briefing.parse_error && briefing.raw_text) {
        try {
          const text = briefing.raw_text;
          let cleaned = text.trim().replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
          let parsed: any;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
            }
          }
          if (parsed && !parsed.parse_error) {
            setEditedBriefing({ ...parsed });
            if (parsed.attachments) setAttachments(parsed.attachments);
            toast.info("Briefing recuperado desde texto sin procesar");
            // Persist the fix to DB
            if (projectId) {
              supabase
                .from("project_wizard_steps")
                .update({ output_data: parsed })
                .eq("project_id", projectId)
                .eq("step_number", 2)
                .then(() => {});
            }
            return;
          }
        } catch {
          // Could not recover, fall through
        }
      }
      setEditedBriefing({ ...briefing });
      if (briefing.attachments) setAttachments(briefing.attachments);
    }
  }, [briefing, projectId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !projectId) return;
    setUploading(true);
    const newAttachments: AttachmentMeta[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} excede 10MB`);
          continue;
        }
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `${projectId}/attachments/${safeName}`;
        const { error } = await supabase.storage.from("project-documents").upload(path, file, { upsert: true });
        if (error) {
          toast.error(`Error subiendo ${file.name}: ${error.message}`);
          continue;
        }
        newAttachments.push({ name: file.name, path, size: file.size, type: file.type });
      }
      if (newAttachments.length > 0) {
        const updated = [...attachments, ...newAttachments];
        setAttachments(updated);
        setEditedBriefing((prev: any) => ({ ...prev, attachments: updated }));
        toast.success(`${newAttachments.length} archivo(s) adjuntado(s)`);
      }
    } catch (e: any) {
      toast.error("Error subiendo archivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = async (att: AttachmentMeta) => {
    await supabase.storage.from("project-documents").remove([att.path]);
    const updated = attachments.filter(a => a.path !== att.path);
    setAttachments(updated);
    setEditedBriefing((prev: any) => ({ ...prev, attachments: updated }));
    toast.success("Archivo eliminado");
  };

  const handleApprove = () => {
    onApprove({ ...editedBriefing, attachments });
  };

  const updateField = (key: string, value: any) => {
    setEditedBriefing((prev: any) => ({ ...prev, [key]: value }));
  };

  const isPending = (val: unknown): boolean => typeof val === "string" && val.includes("[PENDIENTE DE CONFIRMAR]");

  // ── Pre-extraction & loading states ──────────────────────────────────
  if (!briefing && !generating) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 space-y-6 max-w-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Extracción Inteligente</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gemini Flash analizará el material de entrada y generará un briefing estructurado con todos los datos del proyecto.
              </p>
            </div>
          </div>
          <Card className="border-border/30 bg-muted/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Material de entrada · {inputContent.length.toLocaleString()} caracteres
              </p>
              <p className="text-sm text-foreground/80 line-clamp-5 whitespace-pre-wrap leading-relaxed">{inputContent}</p>
            </CardContent>
          </Card>
          <Button onClick={onExtract} className="gap-2 shadow-lg shadow-primary/20" size="lg">
            <Sparkles className="w-4 h-4" /> Extraer briefing con IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-foreground">Analizando con Gemini Flash...</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Filtrando contenido relevante de la transcripción...
              </div>
              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground/50">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                Extrayendo datos del briefing
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Section card component ───────────────────────────────────────────
  const SectionCard = ({
    icon: Icon, title, accent = "border-l-primary/40", children, count, defaultOpen = true,
  }: {
    icon: React.ElementType; title: string; accent?: string; children: React.ReactNode; count?: number; defaultOpen?: boolean;
  }) => (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className={cn("border-border/40 overflow-hidden border-l-[3px]", accent)}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{title}</span>
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  // ── Editable text block ──────────────────────────────────────────────
  const EditableText = ({ fieldKey, rows = 3, textClass = "text-sm" }: { fieldKey: string; rows?: number; textClass?: string }) => {
    const isEditing = editingField === fieldKey;
    const value = editedBriefing?.[fieldKey] || "";
    return (
      <div className="relative group">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => updateField(fieldKey, e.target.value)}
              rows={rows}
              className="text-sm bg-background resize-none"
              autoFocus
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingField(null)}>
              <Check className="w-3 h-3 mr-1" /> Listo
            </Button>
          </div>
        ) : (
          <div
            onClick={() => setEditingField(fieldKey)}
            className={cn(
              "cursor-pointer rounded-lg p-3 hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50",
              isPending(value) && "bg-amber-500/5 border-amber-500/20",
              textClass
            )}
          >
            <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{value || <span className="text-muted-foreground italic">Sin datos</span>}</p>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 absolute top-2 right-2 transition-colors" />
            {isPending(value) && (
              <div className="flex items-center gap-1 mt-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] text-amber-500 font-medium">Pendiente de confirmar</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Main briefing view ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Briefing Extraído</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Haz clic en cualquier campo para editarlo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowOriginal(!showOriginal)} className="gap-1.5">
            <Eye className="w-3.5 h-3.5" /> {showOriginal ? "Ocultar" : "Ver"} original
          </Button>
          <Button variant="outline" size="sm" onClick={onExtract} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerar
          </Button>
          {projectId && editedBriefing && (
            <ProjectDocumentDownload
              projectId={projectId}
              stepNumber={2}
              content={editedBriefing}
              contentType="json"
              projectName={projectName || ""}
              company={company}
              version={version}
              size="sm"
            />
          )}
          <Button size="sm" onClick={handleApprove} className="gap-1.5 shadow-sm">
            <Check className="w-3.5 h-3.5" /> Aprobar briefing
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {editedBriefing && (() => {
        const isV3 = !!editedBriefing.project_summary;
        const complexity = isV3 ? editedBriefing.project_summary?.complexity_level : editedBriefing.nivel_complejidad;
        const urgency = isV3 ? editedBriefing.project_summary?.urgency_level : editedBriefing.urgencia;
        const confidence = editedBriefing.confianza_extracción;
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Complejidad:</span>
              {levelBadge(complexity, "complexity")}
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Urgencia:</span>
              {levelBadge(urgency, "urgency")}
            </div>
            {confidence && (
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Confianza:</span>
                {levelBadge(confidence, "confidence")}
              </div>
            )}
            {isV3 && <Badge variant="outline" className="text-[10px] h-5">v3</Badge>}
          </div>
        );
      })()}

      {/* Filter badge */}
      {editedBriefing?._was_filtered && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Transcripción filtrada automáticamente — se eliminó contenido no relevante para el proyecto</span>
        </div>
      )}

      {/* Collapsible original material */}
      {showOriginal && (
        <Card className="border-border/30 bg-muted/10">
          <CardContent className="p-4">
            {editedBriefing?._was_filtered && editedBriefing?._filtered_content ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Filtrado para proyecto · {editedBriefing._filtered_content.length.toLocaleString()} caracteres
                  </p>
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {Math.round((1 - editedBriefing._filtered_content.length / inputContent.length) * 100)}% reducido
                  </Badge>
                </div>
                <ScrollArea className="h-48">
                  <p className="text-sm text-foreground/70 whitespace-pre-wrap leading-relaxed">{editedBriefing._filtered_content}</p>
                </ScrollArea>
                <Collapsible className="mt-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
                      <Eye className="w-3 h-3" /> Ver original completo ({inputContent.length.toLocaleString()} caracteres)
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-48 mt-2">
                      <p className="text-sm text-foreground/50 whitespace-pre-wrap leading-relaxed">{inputContent}</p>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Material Original · {inputContent.length.toLocaleString()} caracteres
                </p>
                <ScrollArea className="h-48">
                  <p className="text-sm text-foreground/70 whitespace-pre-wrap leading-relaxed">{inputContent}</p>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Attachments */}
      {editedBriefing && (
        <Card className="border-border/40 overflow-hidden border-l-[3px] border-l-sky-500/40">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Documentos del Cliente</span>
              {attachments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{attachments.length}</Badge>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Adjuntar archivos
              </Button>
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="px-4 pb-3 space-y-1.5">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground/80 flex-1 truncate">{att.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{(att.size / 1024).toFixed(0)} KB</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeAttachment(att)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {attachments.length === 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">
                Adjunta documentos del cliente (PDF, DOCX, Excel, etc.) para enriquecer el documento de alcance.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Briefing cards — V3 or Legacy */}
      {editedBriefing && (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-3 pr-2">
            {editedBriefing.project_summary ? (
              /* ═══════════ V3 SCHEMA RENDERING ═══════════ */
              <>
                {/* Project Summary */}
                <SectionCard icon={FileText} title="Resumen del Proyecto" accent="border-l-primary/60">
                  <div className="space-y-2">
                    {editedBriefing.project_summary.title && (
                      <p className="text-base font-semibold text-foreground">{editedBriefing.project_summary.title}</p>
                    )}
                    {editedBriefing.project_summary.context && (
                      <p className="text-sm text-foreground/80 leading-relaxed">{editedBriefing.project_summary.context}</p>
                    )}
                    {editedBriefing.project_summary.primary_goal && (
                      <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                        <p className="text-xs font-semibold text-primary mb-0.5">Objetivo principal</p>
                        <p className="text-sm text-foreground/90">{editedBriefing.project_summary.primary_goal}</p>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Observed Facts */}
                {editedBriefing.observed_facts?.length > 0 && (
                  <SectionCard icon={CheckCircle2} title="Hechos Observados" accent="border-l-emerald-500/50" count={editedBriefing.observed_facts.length}>
                    <BriefItemList items={editedBriefing.observed_facts} colorScheme="emerald" />
                  </SectionCard>
                )}

                {/* Inferred Needs */}
                {editedBriefing.inferred_needs?.length > 0 && (
                  <SectionCard icon={Lightbulb} title="Necesidades Inferidas" accent="border-l-blue-500/50" count={editedBriefing.inferred_needs.length}>
                    <BriefItemList items={editedBriefing.inferred_needs} colorScheme="blue" />
                  </SectionCard>
                )}

                {/* Solution Candidates */}
                {editedBriefing.solution_candidates?.length > 0 && (
                  <SectionCard icon={Cpu} title="Candidatos de Solución" accent="border-l-violet-500/50" count={editedBriefing.solution_candidates.length}>
                    <BriefItemList items={editedBriefing.solution_candidates} colorScheme="violet" showComponentType />
                  </SectionCard>
                )}

                {/* Constraints & Risks */}
                {editedBriefing.constraints_and_risks?.length > 0 && (
                  <SectionCard icon={Lock} title="Restricciones y Riesgos" accent="border-l-destructive/50" count={editedBriefing.constraints_and_risks.length}>
                    <BriefItemList items={editedBriefing.constraints_and_risks} colorScheme="red" />
                  </SectionCard>
                )}

                {/* Open Questions */}
                {editedBriefing.open_questions?.length > 0 && (
                  <SectionCard icon={CircleHelp} title="Preguntas Abiertas" accent="border-l-amber-500/50" count={editedBriefing.open_questions.length}>
                    <BriefItemList items={editedBriefing.open_questions} colorScheme="amber" />
                  </SectionCard>
                )}

                {/* Architecture Signals */}
                {editedBriefing.architecture_signals?.length > 0 && (
                  <SectionCard icon={Layers} title="Señales de Arquitectura" accent="border-l-cyan-500/50" count={editedBriefing.architecture_signals.length}>
                    <BriefItemList items={editedBriefing.architecture_signals} colorScheme="cyan" showComponentType />
                  </SectionCard>
                )}

                {/* Extraction Warnings */}
                {editedBriefing.extraction_warnings?.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5 overflow-hidden border-l-[3px] border-l-destructive/60">
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Alertas de Integridad</span>
                      <Badge variant="destructive" className="text-[10px] h-5">{editedBriefing.extraction_warnings.length}</Badge>
                    </div>
                    <div className="px-4 pb-4 space-y-1.5">
                      {editedBriefing.extraction_warnings.map((w: any, i: number) => {
                        const isLongInput = typeof w === "object" && w?.type === "long_input_sampled";
                        return (
                          <div key={i} className="flex flex-col gap-2 p-2 rounded-lg bg-background/50">
                            <div className="flex items-start gap-2">
                              <Info className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                              <p className="text-sm text-foreground/80">{typeof w === "string" ? w : w.message || w.description || JSON.stringify(w)}</p>
                            </div>
                            {isLongInput && w?.can_force_full && onForceFullExtract && (
                              <button
                                type="button"
                                disabled={generating}
                                onClick={onForceFullExtract}
                                className="self-start text-xs px-2.5 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                              >
                                Forzar contenido completo (sin muestreo)
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Contract validation */}
                {editedBriefing._contract_validation && !editedBriefing._contract_validation.valid && (
                  <Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden border-l-[3px] border-l-amber-500/60">
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600">Validación de Contrato</span>
                    </div>
                    <div className="px-4 pb-4 space-y-1.5">
                      {(editedBriefing._contract_validation.violations || []).map((v: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground/80">{typeof v === "string" ? v : v.message || JSON.stringify(v)}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              /* ═══════════ LEGACY V2 SCHEMA RENDERING ═══════════ */
              <>
                <SectionCard icon={FileText} title="Resumen Ejecutivo" accent="border-l-primary/60">
                  <EditableText fieldKey="resumen_ejecutivo" rows={3} textClass="text-sm" />
                </SectionCard>

                <SectionCard icon={Target} title="Necesidad Principal" accent="border-l-primary/60">
                  <EditableText fieldKey="necesidad_principal" rows={2} />
                </SectionCard>

                {editedBriefing.objetivos?.length > 0 && (
                  <SectionCard icon={ListChecks} title="Objetivos" accent="border-l-blue-500/40" count={editedBriefing.objetivos.length}>
                    <div className="space-y-2">
                      {editedBriefing.objetivos.map((obj: any, i: number) => {
                        const isObj = typeof obj === "object";
                        const priority = isObj ? obj.prioridad : null;
                        const text = isObj ? obj.objetivo : obj;
                        const metric = isObj ? obj.métrica_éxito : null;
                        return (
                          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                            {priority && (
                              <Badge className={cn("text-[10px] font-bold shrink-0 mt-0.5 border", priorityColor(priority))}>
                                {priority}
                              </Badge>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground/90">{text}</p>
                              {metric && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <BarChart3 className="w-3 h-3" /> {metric}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.problemas_detectados?.length > 0 && (
                  <SectionCard icon={ShieldAlert} title="Problemas Detectados" accent="border-l-destructive/40" count={editedBriefing.problemas_detectados.length}>
                    <div className="space-y-2">
                      {editedBriefing.problemas_detectados.map((p: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                          <p className="text-sm text-foreground/90">{typeof p === "object" ? p.problema : p}</p>
                          {typeof p === "object" && (p.gravedad || p.impacto) && (
                            <div className="flex gap-3 mt-1.5">
                              {p.gravedad && <span className="text-xs text-muted-foreground">Gravedad: <strong>{p.gravedad}</strong></span>}
                              {p.impacto && <span className="text-xs text-muted-foreground">Impacto: {p.impacto}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.decisiones_confirmadas?.length > 0 && (
                  <SectionCard icon={CheckCircle2} title="Decisiones Confirmadas" accent="border-l-emerald-500/50" count={editedBriefing.decisiones_confirmadas.length}>
                    <div className="space-y-2">
                      {editedBriefing.decisiones_confirmadas.map((d: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-foreground/90">{d.decisión}</p>
                              {d.contexto && <p className="text-xs text-muted-foreground mt-0.5">{d.contexto}</p>}
                              {d.implicación_técnica && <p className="text-xs text-muted-foreground/70 mt-0.5">→ {d.implicación_técnica}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.decisiones_pendientes?.length > 0 && (
                  <SectionCard icon={HelpCircle} title="Decisiones Pendientes" accent="border-l-amber-500/50" count={editedBriefing.decisiones_pendientes.length}>
                    <div className="space-y-2">
                      {editedBriefing.decisiones_pendientes.map((d: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                          <p className="text-sm font-medium text-foreground/90">{d.tema}</p>
                          {Array.isArray(d.opciones) && d.opciones.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Opciones: {d.opciones.join(" · ")}</p>
                          )}
                          {d.dependencia && <p className="text-xs text-amber-600 mt-0.5">⚡ Bloquea: {d.dependencia}</p>}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.stakeholders?.length > 0 && (
                  <SectionCard icon={Users} title="Stakeholders" accent="border-l-violet-500/40" count={editedBriefing.stakeholders.length}>
                    <div className="space-y-2">
                      {editedBriefing.stakeholders.map((s: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{s.nombre}</span>
                            {(s.tipo || s.relevancia) && <Badge variant="outline" className="text-[10px]">{s.tipo || s.relevancia}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.rol}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.datos_cuantitativos?.cifras_clave?.length > 0 && (
                  <SectionCard icon={BarChart3} title="Datos Cuantitativos" accent="border-l-cyan-500/40" count={editedBriefing.datos_cuantitativos.cifras_clave.length}>
                    <div className="space-y-1.5">
                      {editedBriefing.datos_cuantitativos.cifras_clave.map((c: any, i: number) => (
                        <div key={i} className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-bold text-primary">{c.valor}</span>
                          <span className="text-sm text-foreground/70">{c.descripción}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.integraciones_identificadas?.length > 0 && (
                  <SectionCard icon={Plug} title="Integraciones" accent="border-l-indigo-500/40" count={editedBriefing.integraciones_identificadas.length}>
                    <div className="space-y-1.5">
                      {editedBriefing.integraciones_identificadas.map((integ: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                          <Badge variant="outline" className="text-[10px] shrink-0">{integ.tipo}</Badge>
                          <span className="text-sm text-foreground/80 flex-1">{integ.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {editedBriefing.alertas?.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5 overflow-hidden border-l-[3px] border-l-destructive/60">
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Alertas</span>
                      <Badge variant="destructive" className="text-[10px] h-5">{editedBriefing.alertas.length}</Badge>
                    </div>
                    <div className="px-4 pb-4 space-y-2">
                      {editedBriefing.alertas.map((a: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-background/50">
                          <p className="text-sm text-foreground/90">{a.descripción}</p>
                          {a.acción_sugerida && <p className="text-xs text-muted-foreground mt-1">→ {a.acción_sugerida}</p>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {editedBriefing.datos_faltantes?.length > 0 && (
                  <Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden border-l-[3px] border-l-amber-500/60">
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600">Datos Faltantes</span>
                    </div>
                    <div className="px-4 pb-4 space-y-1.5">
                      {editedBriefing.datos_faltantes.map((d: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground/80">{typeof d === "object" ? d.qué_falta : d}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};