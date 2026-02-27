import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, AlertTriangle, Sparkles, FileText } from "lucide-react";
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

  useEffect(() => {
    if (briefing) setEditedBriefing({ ...briefing });
  }, [briefing]);

  const updateField = (key: string, value: any) => {
    setEditedBriefing((prev: any) => ({ ...prev, [key]: value }));
  };

  const isPending = (val: string) => typeof val === "string" && val.includes("[PENDIENTE DE CONFIRMAR]");

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

                  {/* Objetivos */}
                  {editedBriefing.objetivos?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Objetivos</p>
                      {editedBriefing.objetivos.map((obj: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5">
                          <span className="text-xs text-muted-foreground/50 mt-2.5 w-4 text-right shrink-0">{i + 1}.</span>
                          <Textarea
                            value={obj}
                            onChange={(e) => {
                              const updated = [...editedBriefing.objetivos];
                              updated[i] = e.target.value;
                              updateField("objetivos", updated);
                            }}
                            rows={1}
                            className="text-sm flex-1 bg-background resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Problemas */}
                  {editedBriefing.problemas_detectados?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Problemas Detectados</p>
                      <div className="space-y-1">
                        {editedBriefing.problemas_detectados.map((p: string, i: number) => (
                          <p key={i} className="text-sm text-foreground/80 pl-3 border-l-2 border-red-500/30 py-0.5">{p}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Complejidad</p>
                      <Badge variant="outline" className="text-xs">{editedBriefing.nivel_complejidad || "—"}</Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">Urgencia</p>
                      <Badge variant="outline" className="text-xs">{editedBriefing.urgencia || "—"}</Badge>
                    </div>
                  </div>

                  {/* Datos faltantes */}
                  {editedBriefing.datos_faltantes?.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> Datos Faltantes
                      </p>
                      <div className="space-y-1">
                        {editedBriefing.datos_faltantes.map((d: string, i: number) => (
                          <p key={i} className="text-xs text-foreground/70">• {d}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alcance preliminar */}
                  {editedBriefing.alcance_preliminar && (
                    <div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Alcance Preliminar</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/15">
                          <p className="text-[10px] font-mono text-green-400 mb-1.5">INCLUIDO</p>
                          {(editedBriefing.alcance_preliminar.incluido || []).map((item: string, i: number) => (
                            <p key={i} className="text-xs text-foreground/80 py-0.5">✓ {item}</p>
                          ))}
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                          <p className="text-[10px] font-mono text-red-400 mb-1.5">EXCLUIDO</p>
                          {(editedBriefing.alcance_preliminar.excluido || []).map((item: string, i: number) => (
                            <p key={i} className="text-xs text-foreground/80 py-0.5">✗ {item}</p>
                          ))}
                        </div>
                      </div>
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
