import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  inputContent: string;
  briefing: any;
  generating: boolean;
  onExtract: () => void;
  onApprove: (editedBriefing: any) => void;
}

const BRIEFING_FIELDS = [
  { key: "resumen_ejecutivo", label: "Resumen Ejecutivo", type: "text" },
  { key: "necesidad_principal", label: "Necesidad Principal", type: "text" },
  { key: "nivel_complejidad", label: "Complejidad", type: "badge" },
  { key: "urgencia", label: "Urgencia", type: "badge" },
] as const;

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
      <div className="space-y-4 max-w-2xl">
        <div>
          <h2 className="text-lg font-bold text-foreground">Extracción Inteligente</h2>
          <p className="text-sm text-muted-foreground mt-1">
            La IA analizará el material de entrada y generará un briefing estructurado.
          </p>
        </div>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-mono text-muted-foreground mb-2">MATERIAL DE ENTRADA ({inputContent.length} caracteres)</p>
            <p className="text-sm text-foreground line-clamp-6 whitespace-pre-wrap">{inputContent}</p>
          </CardContent>
        </Card>
        <Button onClick={onExtract} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Extraer briefing
        </Button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Extrayendo briefing con Gemini Flash...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Extracción Inteligente</h2>
          <p className="text-sm text-muted-foreground mt-1">Revisa y edita el briefing antes de aprobar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExtract} className="gap-1">
            <RefreshCw className="w-3 h-3" /> Regenerar
          </Button>
          <Button size="sm" onClick={() => onApprove(editedBriefing)} className="gap-1">
            <Check className="w-3 h-3" /> Aprobar briefing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original material */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground">MATERIAL ORIGINAL</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <p className="text-sm text-foreground whitespace-pre-wrap">{inputContent}</p>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Briefing editable */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground">BRIEFING EXTRAÍDO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[500px] pr-4">
              {editedBriefing && (
                <div className="space-y-4">
                  {/* Resumen ejecutivo */}
                  <div className={cn(isPending(editedBriefing.resumen_ejecutivo) && "ring-2 ring-amber-500/50 rounded-lg p-2")}>
                    <p className="text-xs font-mono text-muted-foreground mb-1 flex items-center gap-1">
                      RESUMEN EJECUTIVO
                      {isPending(editedBriefing.resumen_ejecutivo) && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </p>
                    <Textarea
                      value={editedBriefing.resumen_ejecutivo || ""}
                      onChange={(e) => updateField("resumen_ejecutivo", e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  {/* Necesidad principal */}
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">NECESIDAD PRINCIPAL</p>
                    <Textarea
                      value={editedBriefing.necesidad_principal || ""}
                      onChange={(e) => updateField("necesidad_principal", e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Objetivos */}
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">OBJETIVOS</p>
                    {(editedBriefing.objetivos || []).map((obj: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 mb-1">
                        <span className="text-xs text-muted-foreground mt-2">{i + 1}.</span>
                        <Textarea
                          value={obj}
                          onChange={(e) => {
                            const updated = [...(editedBriefing.objetivos || [])];
                            updated[i] = e.target.value;
                            updateField("objetivos", updated);
                          }}
                          rows={1}
                          className="text-sm flex-1"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Problemas */}
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">PROBLEMAS DETECTADOS</p>
                    {(editedBriefing.problemas_detectados || []).map((p: string, i: number) => (
                      <p key={i} className="text-sm text-foreground py-0.5">• {p}</p>
                    ))}
                  </div>

                  {/* Badges */}
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-1">COMPLEJIDAD</p>
                      <Badge variant="outline">{editedBriefing.nivel_complejidad || "—"}</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-1">URGENCIA</p>
                      <Badge variant="outline">{editedBriefing.urgencia || "—"}</Badge>
                    </div>
                  </div>

                  {/* Datos faltantes */}
                  {editedBriefing.datos_faltantes?.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <p className="text-xs font-mono text-amber-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> DATOS FALTANTES
                      </p>
                      {editedBriefing.datos_faltantes.map((d: string, i: number) => (
                        <p key={i} className="text-xs text-foreground py-0.5">• {d}</p>
                      ))}
                    </div>
                  )}

                  {/* Alcance preliminar */}
                  {editedBriefing.alcance_preliminar && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-1">ALCANCE PRELIMINAR</p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Incluido:</p>
                          {(editedBriefing.alcance_preliminar.incluido || []).map((item: string, i: number) => (
                            <p key={i} className="text-foreground">✓ {item}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Excluido:</p>
                          {(editedBriefing.alcance_preliminar.excluido || []).map((item: string, i: number) => (
                            <p key={i} className="text-foreground">✗ {item}</p>
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
