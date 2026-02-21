import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Radar, Target, BarChart3, Database, AlertTriangle,
  Ruler, Clock, ArrowLeft, Check, Pencil,
} from "lucide-react";

export interface TranslatedIntent {
  problem_definition: string;
  target_variable: string;
  predictive_variables: string[];
  recommended_model_type: string;
  success_metrics: string[];
  likely_data_sources: string[];
  risks_and_limitations: string[];
  suggested_baseline: string;
  prediction_horizons: string[];
  expanded_objective: string;
}

interface PatternIntentReviewProps {
  intent: TranslatedIntent;
  originalParams: {
    sector: string;
    geography?: string;
    time_horizon?: string;
    business_objective?: string;
  };
  onConfirm: (expandedObjective: string) => void;
  onBack: () => void;
  loading?: boolean;
}

export const PatternIntentReview = ({
  intent,
  originalParams,
  onConfirm,
  onBack,
  loading,
}: PatternIntentReviewProps) => {
  const [editing, setEditing] = useState(false);
  const [editedObjective, setEditedObjective] = useState(intent.expanded_objective);

  const sections = [
    {
      icon: <Target className="w-4 h-4" />,
      title: "Definición del Problema",
      content: intent.problem_definition,
    },
    {
      icon: <Ruler className="w-4 h-4" />,
      title: "Variable Objetivo",
      content: intent.target_variable,
    },
    {
      icon: <BarChart3 className="w-4 h-4" />,
      title: "Tipo de Modelo Recomendado",
      content: intent.recommended_model_type,
    },
    {
      icon: <Ruler className="w-4 h-4" />,
      title: "Baseline Sugerido",
      content: intent.suggested_baseline,
    },
  ];

  const listSections = [
    {
      icon: <BarChart3 className="w-4 h-4" />,
      title: "Variables Predictivas",
      items: intent.predictive_variables,
    },
    {
      icon: <Check className="w-4 h-4" />,
      title: "Métricas de Éxito",
      items: intent.success_metrics,
    },
    {
      icon: <Database className="w-4 h-4" />,
      title: "Fuentes de Datos Probables",
      items: intent.likely_data_sources,
    },
    {
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "Riesgos y Limitaciones",
      items: intent.risks_and_limitations,
    },
    {
      icon: <Clock className="w-4 h-4" />,
      title: "Horizontes de Predicción",
      items: intent.prediction_horizons,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Petición Técnica Generada
          </h2>
          <p className="text-xs text-muted-foreground">
            {originalParams.sector} • {originalParams.geography || "Global"} • Revisa y confirma antes de iniciar
          </p>
        </div>
      </div>

      {/* Original input */}
      <Card className="border-primary/20 bg-primary/5 shrink-0">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-1">Tu descripción original:</p>
          <p className="text-sm text-foreground italic">
            "{originalParams.business_objective || "Sin objetivo especificado"}"
          </p>
        </CardContent>
      </Card>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 pr-3">
          {/* Text sections */}
          {sections.map((s, i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                  {s.icon} {s.title.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-sm text-foreground">{s.content}</p>
              </CardContent>
            </Card>
          ))}

          {/* List sections */}
          {listSections.map((s, i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                  {s.icon} {s.title.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {s.items.map((item, j) => (
                    <Badge key={j} variant="outline" className="text-xs font-normal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Expanded objective (editable) */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                <Radar className="w-4 h-4" /> OBJETIVO TÉCNICO EXPANDIDO
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(!editing)}
                className="text-xs gap-1 h-7"
              >
                <Pencil className="w-3 h-3" />
                {editing ? "Vista previa" : "Editar"}
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {editing ? (
                <Textarea
                  value={editedObjective}
                  onChange={(e) => setEditedObjective(e.target.value)}
                  rows={8}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-line">{editedObjective}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border shrink-0">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Button>
        <Button
          onClick={() => onConfirm(editedObjective)}
          disabled={loading}
          className="flex-1 gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Radar className="w-4 h-4" />
          )}
          Confirmar y Arrancar Análisis
        </Button>
      </div>
    </div>
  );
};
