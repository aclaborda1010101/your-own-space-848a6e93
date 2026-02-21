import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { RagProject } from "@/hooks/useRagArchitect";

interface RagDomainReviewProps {
  rag: RagProject;
  onConfirm: (ragId: string, adjustments?: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  confirming: boolean;
}

const relevanceBadge = (r: string) => {
  switch (r) {
    case "critical": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">CRITICAL</Badge>;
    case "high": return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">HIGH</Badge>;
    case "medium": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">MEDIUM</Badge>;
    default: return <Badge className="bg-muted text-muted-foreground">LOW</Badge>;
  }
};

export function RagDomainReview({ rag, onConfirm, onCancel, confirming }: RagDomainReviewProps) {
  const dm = rag.domain_map as Record<string, unknown> | null;
  const [adjustments, setAdjustments] = useState<Record<string, Record<string, unknown>>>({});

  if (!dm) return <div className="text-muted-foreground">No hay análisis disponible.</div>;

  const intent = dm.interpreted_intent as Record<string, unknown> || {};
  const subdomains = (dm.subdomains as Array<Record<string, unknown>>) || [];
  const variables = (dm.critical_variables as Array<Record<string, unknown>>) || [];
  const queries = dm.validation_queries as Record<string, string[]> || {};
  const debates = (dm.known_debates as Array<Record<string, unknown>>) || [];
  const config = dm.recommended_config as Record<string, unknown> || {};

  const toggleSubdomain = (name: string) => {
    setAdjustments((prev) => ({
      ...prev,
      [name]: { ...prev[name], include: prev[name]?.include === false ? true : false },
    }));
  };

  const isIncluded = (name: string) => adjustments[name]?.include !== false;

  const handleConfirm = () => {
    onConfirm(rag.id, adjustments);
  };

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-6 pr-4">
        {/* Intent interpretation */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📋 HEMOS ENTENDIDO QUE:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-semibold">Necesidad real:</span> {intent.real_need as string}</p>
            <p><span className="font-semibold">Perfil consumo:</span> {intent.consumer_profile as string}</p>
            {(intent.primary_questions as string[])?.length > 0 && (
              <div>
                <span className="font-semibold">Preguntas clave:</span>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  {(intent.primary_questions as string[]).map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subdomains */}
        <div>
          <h3 className="text-sm font-bold mb-3">📚 SUBDOMINIOS DETECTADOS ({subdomains.length})</h3>
          <div className="space-y-2">
            {subdomains.map((sub, idx) => (
              <Card key={idx} className={`transition-all ${!isIncluded(sub.name_technical as string) ? "opacity-40" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isIncluded(sub.name_technical as string)}
                        onCheckedChange={() => toggleSubdomain(sub.name_technical as string)}
                      />
                      <span className="font-semibold text-sm">{sub.name_technical as string}</span>
                      <span className="text-xs text-muted-foreground">({sub.name_colloquial as string})</span>
                    </div>
                    {relevanceBadge(sub.relevance as string)}
                  </div>
                  <p className="text-xs text-muted-foreground ml-12">{sub.relevance_note as string}</p>
                  {(sub.key_authors as string[])?.length > 0 && (
                    <p className="text-xs text-muted-foreground ml-12 mt-1">
                      <span className="font-medium">Autores:</span> {(sub.key_authors as string[]).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Variables */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-bold">
            <ChevronDown className="h-4 w-4" />
            📊 VARIABLES CRÍTICAS ({variables.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex flex-wrap gap-2">
              {variables.map((v, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {v.name as string} <span className="text-muted-foreground ml-1">({v.type as string})</span>
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Validation queries */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-bold">
            <ChevronDown className="h-4 w-4" />
            ✅ QUERIES DE VALIDACIÓN
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {Object.entries(queries).map(([type, qs]) => (
              <div key={type}>
                <p className="text-xs font-semibold capitalize text-muted-foreground">{type}</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground">
                  {(qs || []).map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Known debates */}
        {debates.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-bold">
              <ChevronDown className="h-4 w-4" />
              ⚡ DEBATES CONOCIDOS ({debates.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {debates.map((d, i) => (
                <Card key={i} className="bg-muted/30">
                  <CardContent className="p-3 text-xs">
                    <p className="font-semibold">{d.topic as string}</p>
                    <p className="text-muted-foreground mt-1">Consenso: {d.current_consensus as string}</p>
                  </CardContent>
                </Card>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Config */}
        <div className="bg-muted/30 rounded-lg p-3 text-xs">
          <p className="font-semibold mb-1">Build profile recomendado: <Badge variant="secondary">{config.build_profile as string}</Badge></p>
          <p className="text-muted-foreground">~{config.estimated_chunks as number} chunks | ~{config.estimated_time_hours as number}h estimadas</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleConfirm} disabled={confirming} className="flex-1 bg-green-600 hover:bg-green-700">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Confirmar y Construir
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={confirming}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
