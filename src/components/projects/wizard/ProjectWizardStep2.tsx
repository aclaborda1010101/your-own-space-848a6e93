import { useState, useEffect } from "react";
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
  ListChecks, XCircle, Eye, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  inputContent: string;
  briefing: any;
  generating: boolean;
  onExtract: () => void;
  onApprove: (editedBriefing: any) => void;
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

export const ProjectWizardStep2 = ({ inputContent, briefing, generating, onExtract, onApprove }: Props) => {
  const [editedBriefing, setEditedBriefing] = useState<any>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (briefing) setEditedBriefing({ ...briefing });
  }, [briefing]);

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
        <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Analizando con Gemini Flash...</p>
            <p className="text-xs text-muted-foreground mt-1">Extrayendo datos del briefing</p>
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
          <Button size="sm" onClick={() => onApprove(editedBriefing)} className="gap-1.5 shadow-sm">
            <Check className="w-3.5 h-3.5" /> Aprobar briefing
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {editedBriefing && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Complejidad:</span>
            {levelBadge(editedBriefing.nivel_complejidad, "complexity")}
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Urgencia:</span>
            {levelBadge(editedBriefing.urgencia, "urgency")}
          </div>
          {editedBriefing.confianza_extracción && (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Confianza:</span>
              {levelBadge(editedBriefing.confianza_extracción, "confidence")}
            </div>
          )}
        </div>
      )}

      {/* Collapsible original material */}
      {showOriginal && (
        <Card className="border-border/30 bg-muted/10">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Material Original · {inputContent.length.toLocaleString()} caracteres
            </p>
            <ScrollArea className="h-48">
              <p className="text-sm text-foreground/70 whitespace-pre-wrap leading-relaxed">{inputContent}</p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Briefing cards */}
      {editedBriefing && (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3 pr-2">
            {/* Resumen Ejecutivo */}
            <SectionCard icon={FileText} title="Resumen Ejecutivo" accent="border-l-primary/60">
              <EditableText fieldKey="resumen_ejecutivo" rows={3} textClass="text-sm" />
            </SectionCard>

            {/* Necesidad Principal */}
            <SectionCard icon={Target} title="Necesidad Principal" accent="border-l-primary/60">
              <EditableText fieldKey="necesidad_principal" rows={2} />
            </SectionCard>

            {/* Objetivos */}
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

            {/* Problemas Detectados */}
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

            {/* Decisiones Confirmadas */}
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

            {/* Decisiones Pendientes */}
            {editedBriefing.decisiones_pendientes?.length > 0 && (
              <SectionCard icon={HelpCircle} title="Decisiones Pendientes" accent="border-l-amber-500/50" count={editedBriefing.decisiones_pendientes.length}>
                <div className="space-y-2">
                  {editedBriefing.decisiones_pendientes.map((d: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                      <p className="text-sm font-medium text-foreground/90">{d.tema}</p>
                      {d.opciones?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Opciones: {d.opciones.join(" · ")}</p>
                      )}
                      {d.dependencia && <p className="text-xs text-amber-600 mt-0.5">⚡ Bloquea: {d.dependencia}</p>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Stakeholders */}
            {editedBriefing.stakeholders?.length > 0 && (
              <SectionCard icon={Users} title="Stakeholders" accent="border-l-violet-500/40" count={editedBriefing.stakeholders.length}>
                <div className="space-y-2">
                  {editedBriefing.stakeholders.map((s: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{s.nombre}</span>
                        {(s.tipo || s.relevancia) && <Badge variant="outline" className="text-[10px]">{s.tipo || s.relevancia}</Badge>}
                        {s.poder_decisión && <Badge className={cn("text-[10px] border", priorityColor(s.poder_decisión === "alto" ? "P0" : s.poder_decisión === "medio" ? "P1" : "P2"))}>{s.poder_decisión}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.rol}</p>
                      {s.dolor_principal && <p className="text-xs text-destructive/80 mt-1">🔥 {s.dolor_principal}</p>}
                      {s.notas && <p className="text-xs text-muted-foreground/70 mt-0.5">{s.notas}</p>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Datos Cuantitativos */}
            {editedBriefing.datos_cuantitativos?.cifras_clave?.length > 0 && (
              <SectionCard icon={BarChart3} title="Datos Cuantitativos" accent="border-l-cyan-500/40" count={editedBriefing.datos_cuantitativos.cifras_clave.length}>
                <div className="space-y-1.5">
                  {editedBriefing.datos_cuantitativos.cifras_clave.map((c: any, i: number) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-bold text-primary">{c.valor}</span>
                      <span className="text-sm text-foreground/70">{c.descripción}</span>
                      {c.fuente && <span className="text-[10px] text-muted-foreground">({c.fuente})</span>}
                    </div>
                  ))}
                  {editedBriefing.datos_cuantitativos.presupuesto_cliente && (
                    <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <span className="text-xs text-muted-foreground">💰 Presupuesto:</span>{" "}
                      <span className="text-sm font-semibold text-foreground">{editedBriefing.datos_cuantitativos.presupuesto_cliente}</span>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Integraciones */}
            {editedBriefing.integraciones_identificadas?.length > 0 && (
              <SectionCard icon={Plug} title="Integraciones" accent="border-l-indigo-500/40" count={editedBriefing.integraciones_identificadas.length}>
                <div className="space-y-1.5">
                  {editedBriefing.integraciones_identificadas.map((integ: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                      <Badge variant="outline" className="text-[10px] shrink-0">{integ.tipo}</Badge>
                      <span className="text-sm text-foreground/80 flex-1">{integ.nombre}</span>
                      <Badge className={cn("text-[10px]", integ.estado === "confirmado" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground")}>{integ.estado}</Badge>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Alertas */}
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

            {/* Datos Faltantes */}
            {editedBriefing.datos_faltantes?.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden border-l-[3px] border-l-amber-500/60">
                <div className="px-4 py-3 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600">Datos Faltantes</span>
                  <Badge className="text-[10px] h-5 bg-amber-500/15 text-amber-600">{editedBriefing.datos_faltantes.length}</Badge>
                </div>
                <div className="px-4 pb-4 space-y-1.5">
                  {editedBriefing.datos_faltantes.map((d: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-foreground/80">{typeof d === "object" ? d.qué_falta : d}</p>
                        {typeof d === "object" && d.impacto && <p className="text-xs text-muted-foreground">Impacto: {d.impacto}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Alcance Preliminar */}
            {editedBriefing.alcance_preliminar && (
              <SectionCard icon={ListChecks} title="Alcance Preliminar" accent="border-l-teal-500/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> INCLUIDO
                    </p>
                    {(editedBriefing.alcance_preliminar.incluido || []).map((item: any, i: number) => (
                      <div key={i} className="py-1 border-b border-emerald-500/10 last:border-0">
                        <p className="text-sm text-foreground/80">{typeof item === "object" ? item.funcionalidad : item}</p>
                        {typeof item === "object" && item.prioridad && (
                          <span className="text-[10px] text-muted-foreground">{item.prioridad}{item.módulo ? ` · ${item.módulo}` : ""}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                    <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> EXCLUIDO
                    </p>
                    {(editedBriefing.alcance_preliminar.excluido || []).map((item: any, i: number) => (
                      <div key={i} className="py-1 border-b border-destructive/10 last:border-0">
                        <p className="text-sm text-foreground/80">{typeof item === "object" ? item.funcionalidad : item}</p>
                        {typeof item === "object" && item.motivo && (
                          <span className="text-[10px] text-muted-foreground">{item.motivo}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};