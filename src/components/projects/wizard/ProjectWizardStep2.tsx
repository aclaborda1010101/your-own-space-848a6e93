import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, AlertTriangle, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  inputContent: string;
  briefing: any;
  generating: boolean;
  onExtract: () => void;
  onApprove: (editedBriefing: any) => void;
}

export const ProjectWizardStep2 = ({ inputContent, briefing, generating, onExtract, onApprove }: Props) => {
  const [editedBriefing, setEditedBriefing] = useState<any>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (briefing) setEditedBriefing({ ...briefing });
  }, [briefing]);

  const updateField = (key: string, value: any) => {
    setEditedBriefing((prev: any) => ({ ...prev, [key]: value }));
  };

  const isPending = (val: unknown): boolean => typeof val === "string" && val.includes("[PENDIENTE DE CONFIRMAR]");

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SectionHeader = ({ id, title, count }: { id: string; title: string; count?: number }) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center gap-1.5 w-full text-left group"
    >
      {collapsedSections[id] ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest group-hover:text-muted-foreground transition-colors">
        {title}
      </span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-1">{count}</Badge>
      )}
    </button>
  );

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
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">
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
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Analizando con Gemini Flash...</p>
            <p className="text-xs text-muted-foreground mt-1">Extrayendo datos del briefing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Briefing Extraído</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Revisa, edita los campos y aprueba cuando esté listo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExtract} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerar
          </Button>
          <Button size="sm" onClick={() => onApprove(editedBriefing)} className="gap-1.5 shadow-sm">
            <Check className="w-3.5 h-3.5" /> Aprobar briefing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original material */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Material Original</p>
            <ScrollArea className="h-[520px]">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{inputContent}</p>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Briefing editable */}
        <Card className="border-border/50 border-primary/10">
          <CardContent className="p-4">
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Briefing Extraído</p>
            <ScrollArea className="h-[520px] pr-3">
              {editedBriefing && (
                <div className="space-y-5">
                  {/* Resumen */}
                  <div className={cn(isPending(editedBriefing.resumen_ejecutivo) && "ring-1 ring-amber-500/40 rounded-lg p-3 bg-amber-500/5")}>
                    <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      Resumen Ejecutivo
                      {isPending(editedBriefing.resumen_ejecutivo) && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </p>
                    <Textarea
                      value={editedBriefing.resumen_ejecutivo || ""}
                      onChange={(e) => updateField("resumen_ejecutivo", e.target.value)}
                      rows={3}
                      className="text-sm bg-background resize-none"
                    />
                  </div>

                  {/* Necesidad */}
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Necesidad Principal</p>
                    <Textarea
                      value={editedBriefing.necesidad_principal || ""}
                      onChange={(e) => updateField("necesidad_principal", e.target.value)}
                      rows={2}
                      className="text-sm bg-background resize-none"
                    />
                  </div>

                  {/* Objetivos (structured) */}
                  {editedBriefing.objetivos?.length > 0 && (
                    <div>
                      <SectionHeader id="objetivos" title="Objetivos" count={editedBriefing.objetivos.length} />
                      {!collapsedSections.objetivos && editedBriefing.objetivos.map((obj: any, i: number) => (
                        <div key={i} className="mt-2 p-2.5 rounded-lg bg-muted/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {typeof obj === 'object' ? obj.prioridad || "—" : `${i + 1}`}
                            </Badge>
                            <Textarea
                              value={typeof obj === 'object' ? obj.objetivo : obj}
                              onChange={(e) => {
                                const updated = [...editedBriefing.objetivos];
                                if (typeof obj === 'object') {
                                  updated[i] = { ...obj, objetivo: e.target.value };
                                } else {
                                  updated[i] = e.target.value;
                                }
                                updateField("objetivos", updated);
                              }}
                              rows={1}
                              className="text-sm flex-1 bg-background resize-none"
                            />
                          </div>
                          {typeof obj === 'object' && obj.métrica_éxito && (
                            <p className="text-[10px] text-muted-foreground pl-1">📏 {obj.métrica_éxito}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Problemas (structured) */}
                  {editedBriefing.problemas_detectados?.length > 0 && (
                    <div>
                      <SectionHeader id="problemas" title="Problemas Detectados" count={editedBriefing.problemas_detectados.length} />
                      {!collapsedSections.problemas && (
                        <div className="space-y-1 mt-2">
                          {editedBriefing.problemas_detectados.map((p: any, i: number) => (
                            <div key={i} className="text-sm text-foreground/80 pl-3 border-l-2 border-red-500/30 py-1">
                              <p>{typeof p === 'object' ? p.problema : p}</p>
                              {typeof p === 'object' && p.gravedad && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Gravedad: {p.gravedad} · Impacto: {p.impacto || "—"}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Decisiones confirmadas */}
                  {editedBriefing.decisiones_confirmadas?.length > 0 && (
                    <div>
                      <SectionHeader id="decisiones" title="Decisiones Confirmadas" count={editedBriefing.decisiones_confirmadas.length} />
                      {!collapsedSections.decisiones && (
                        <div className="space-y-1.5 mt-2">
                          {editedBriefing.decisiones_confirmadas.map((d: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
                              <p className="text-sm font-medium text-foreground/90">✓ {d.decisión}</p>
                              {d.contexto && <p className="text-xs text-muted-foreground mt-0.5">{d.contexto}</p>}
                              {d.implicación_técnica && <p className="text-[10px] text-muted-foreground/70 mt-0.5">→ {d.implicación_técnica}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Decisiones pendientes */}
                  {editedBriefing.decisiones_pendientes?.length > 0 && (
                    <div>
                      <SectionHeader id="pendientes" title="Decisiones Pendientes" count={editedBriefing.decisiones_pendientes.length} />
                      {!collapsedSections.pendientes && (
                        <div className="space-y-1.5 mt-2">
                          {editedBriefing.decisiones_pendientes.map((d: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                              <p className="text-sm font-medium text-foreground/90">⏳ {d.tema}</p>
                              {d.opciones?.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">Opciones: {d.opciones.join(" / ")}</p>
                              )}
                              {d.dependencia && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Bloquea: {d.dependencia}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stakeholders (enriched) */}
                  {editedBriefing.stakeholders?.length > 0 && (
                    <div>
                      <SectionHeader id="stakeholders" title="Stakeholders" count={editedBriefing.stakeholders.length} />
                      {!collapsedSections.stakeholders && (
                        <div className="space-y-1.5 mt-2">
                          {editedBriefing.stakeholders.map((s: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg bg-muted/30 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground/90">{s.nombre}</p>
                                <Badge variant="outline" className="text-[9px]">{s.tipo || s.relevancia || "—"}</Badge>
                                {s.poder_decisión && <Badge variant="secondary" className="text-[9px]">Decisión: {s.poder_decisión}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{s.rol}</p>
                              {s.dolor_principal && <p className="text-[10px] text-red-400/80">🔥 {s.dolor_principal}</p>}
                              {s.notas && <p className="text-[10px] text-muted-foreground/70">{s.notas}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Datos cuantitativos */}
                  {editedBriefing.datos_cuantitativos?.cifras_clave?.length > 0 && (
                    <div>
                      <SectionHeader id="cuantitativos" title="Datos Cuantitativos" count={editedBriefing.datos_cuantitativos.cifras_clave.length} />
                      {!collapsedSections.cuantitativos && (
                        <div className="mt-2 space-y-1">
                          {editedBriefing.datos_cuantitativos.cifras_clave.map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="font-mono text-primary font-medium">{c.valor}</span>
                              <span className="text-foreground/70">{c.descripción}</span>
                              {c.fuente && <span className="text-[10px] text-muted-foreground">({c.fuente})</span>}
                            </div>
                          ))}
                          {editedBriefing.datos_cuantitativos.presupuesto_cliente && (
                            <p className="text-xs text-muted-foreground mt-1.5">
                              💰 Presupuesto cliente: {editedBriefing.datos_cuantitativos.presupuesto_cliente}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Integraciones */}
                  {editedBriefing.integraciones_identificadas?.length > 0 && (
                    <div>
                      <SectionHeader id="integraciones" title="Integraciones" count={editedBriefing.integraciones_identificadas.length} />
                      {!collapsedSections.integraciones && (
                        <div className="mt-2 space-y-1">
                          {editedBriefing.integraciones_identificadas.map((integ: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-[9px]">{integ.tipo}</Badge>
                              <span className="text-foreground/80">{integ.nombre}</span>
                              <Badge variant={integ.estado === "confirmado" ? "default" : "secondary"} className="text-[9px]">
                                {integ.estado}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Badges: Complejidad, Urgencia, Confianza */}
                  <div className="flex gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Complejidad</p>
                      <Badge variant="outline" className="text-xs">{editedBriefing.nivel_complejidad || "—"}</Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Urgencia</p>
                      <Badge variant="outline" className="text-xs">{editedBriefing.urgencia || "—"}</Badge>
                    </div>
                    {editedBriefing.confianza_extracción && (
                      <div>
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Confianza</p>
                        <Badge variant="outline" className="text-xs">{editedBriefing.confianza_extracción}</Badge>
                      </div>
                    )}
                  </div>

                  {/* Alertas */}
                  {editedBriefing.alertas?.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/20">
                      <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> Alertas
                      </p>
                      <div className="space-y-1.5">
                        {editedBriefing.alertas.map((a: any, i: number) => (
                          <div key={i}>
                            <p className="text-xs text-foreground/80">⚠ {a.descripción}</p>
                            {a.acción_sugerida && <p className="text-[10px] text-muted-foreground ml-4">→ {a.acción_sugerida}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Datos faltantes (structured) */}
                  {editedBriefing.datos_faltantes?.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> Datos Faltantes
                      </p>
                      <div className="space-y-1">
                        {editedBriefing.datos_faltantes.map((d: any, i: number) => (
                          <div key={i}>
                            <p className="text-xs text-foreground/70">
                              • {typeof d === 'object' ? d.qué_falta : d}
                            </p>
                            {typeof d === 'object' && d.impacto && (
                              <p className="text-[10px] text-muted-foreground ml-3">Impacto: {d.impacto}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alcance preliminar */}
                  {editedBriefing.alcance_preliminar && (
                    <div>
                      <SectionHeader id="alcance" title="Alcance Preliminar" />
                      {!collapsedSections.alcance && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/15">
                            <p className="text-[10px] font-mono text-green-400 mb-1.5">INCLUIDO</p>
                            {(editedBriefing.alcance_preliminar.incluido || []).map((item: any, i: number) => (
                              <div key={i} className="py-0.5">
                                <p className="text-xs text-foreground/80">
                                  ✓ {typeof item === 'object' ? item.funcionalidad : item}
                                </p>
                                {typeof item === 'object' && item.prioridad && (
                                  <span className="text-[9px] text-muted-foreground ml-3">{item.prioridad} · {item.módulo || ""}</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                            <p className="text-[10px] font-mono text-red-400 mb-1.5">EXCLUIDO</p>
                            {(editedBriefing.alcance_preliminar.excluido || []).map((item: any, i: number) => (
                              <div key={i} className="py-0.5">
                                <p className="text-xs text-foreground/80">
                                  ✗ {typeof item === 'object' ? item.funcionalidad : item}
                                </p>
                                {typeof item === 'object' && item.motivo && (
                                  <span className="text-[9px] text-muted-foreground ml-3">{item.motivo}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
