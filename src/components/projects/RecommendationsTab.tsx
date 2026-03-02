import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, TrendingUp, DollarSign, Zap, Download, AlertTriangle, ArrowRight, FileText } from "lucide-react";
import { useDocxExport } from "@/hooks/useDocxExport";
import type { Recommendation } from "@/hooks/useBusinessLeverage";

interface Props {
  recommendations: Recommendation[];
  hasDiagnostic: boolean;
  loading: boolean;
  onGenerate: () => Promise<void>;
  auditId?: string;
  auditName?: string;
}

const layerConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Quick Wins", color: "bg-green-500/10 text-green-400 border-green-500/30", emoji: "🟢" },
  2: { label: "Optimización Workflow", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", emoji: "🟡" },
  3: { label: "Ventaja Competitiva", color: "bg-orange-500/10 text-orange-400 border-orange-500/30", emoji: "🟠" },
  4: { label: "Nuevos Ingresos", color: "bg-red-500/10 text-red-400 border-red-500/30", emoji: "🔴" },
  5: { label: "Transformación", color: "bg-purple-500/10 text-purple-400 border-purple-500/30", emoji: "🟣" },
};

const effortBadge: Record<string, string> = {
  low: "bg-green-500/10 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  high: "bg-red-500/10 text-red-400 border-red-500/30",
};

const ttvBadge: Record<string, string> = {
  corto: "bg-green-500/10 text-green-400 border-green-500/30",
  medio: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  largo: "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

export const RecommendationsTab = ({ recommendations, hasDiagnostic, loading, onGenerate, auditId, auditName }: Props) => {
  const { generatingDocx, exportDocx } = useDocxExport();

  if (!hasDiagnostic) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Genera la radiografía primero.</div>;
  }

  const grouped = [1, 2, 3, 4, 5].map(layer => ({
    layer,
    ...layerConfig[layer],
    items: recommendations.filter(r => r.layer === layer).sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)),
  })).filter(g => g.items.length > 0);

  const buildMarkdown = () => {
    const lines: string[] = ["# Plan por Capas\n"];
    grouped.forEach(g => {
      lines.push(`## Capa ${g.layer} — ${g.label}`);
      g.items.forEach(r => {
        lines.push(`### ${r.title}`);
        lines.push(r.description || "");
        lines.push(`- **Tiempo ahorrado**: ${r.time_saved_hours_week_min}-${r.time_saved_hours_week_max}h/sem`);
        lines.push(`- **Productividad**: +${r.productivity_uplift_pct_min}-${r.productivity_uplift_pct_max}%`);
        lines.push(`- **Dificultad**: ${r.difficulty} · ${r.implementation_time}`);
        if (r.effort_level) lines.push(`- **Esfuerzo**: ${r.effort_level}`);
        if (r.time_to_value) lines.push(`- **Tiempo a valor**: ${r.time_to_value}`);
        if (r.dependencies?.length) lines.push(`- **Dependencias**: ${(r.dependencies as string[]).join(", ")}`);
        lines.push("");
      });
    });
    return lines.join("\n");
  };

  const handleExportMd = () => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "plan-capas.md"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocx = () => {
    if (!auditId || !auditName) return;
    exportDocx({ auditId, auditName, stepNumber: 13, markdownContent: buildMarkdown() });
  };

  return (
    <div className="space-y-4">
      {recommendations.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">Genera recomendaciones basadas en el diagnóstico.</p>
          <Button onClick={onGenerate} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generar Plan por Capas
          </Button>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="flex justify-end gap-2">
          {auditId && auditName && (
            <Button variant="outline" size="sm" onClick={handleExportDocx} disabled={generatingDocx} className="gap-1">
              {generatingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Exportar DOCX
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportMd}>
            <Download className="w-4 h-4" /> Exportar MD
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Regenerar
          </Button>
        </div>
      )}

      {grouped.map(group => (
        <div key={group.layer}>
          <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-2">
            {group.emoji} CAPA {group.layer} — {group.label.toUpperCase()} ({group.items.length})
          </p>
          <div className="space-y-2">
            {group.items.map(rec => {
              const deps = (rec.dependencies || []) as string[];
              return (
                <Card key={rec.id} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{rec.title}</p>
                          {rec.implementable_under_14_days && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                              <Zap className="w-3 h-3 mr-1" /> &lt;14 días
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                        {rec.unlocks && (
                          <p className="text-xs text-primary mt-1 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> Desbloquea: {rec.unlocks}
                          </p>
                        )}
                        {rec.skip_risk && (
                          <p className="text-xs text-orange-400/80 mt-0.5 flex items-center gap-1 italic">
                            <AlertTriangle className="w-3 h-3" /> {rec.skip_risk}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono text-primary">{rec.priority_score?.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">priority</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{rec.time_saved_hours_week_min}-{rec.time_saved_hours_week_max}h/sem</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3" />
                        <span>+{rec.productivity_uplift_pct_min}-{rec.productivity_uplift_pct_max}%</span>
                      </div>
                      {rec.confidence_display !== "low" ? (
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <DollarSign className="w-3 h-3" />
                          <span>€{rec.revenue_impact_month_min?.toLocaleString()}-{rec.revenue_impact_month_max?.toLocaleString()}/mes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
                          <DollarSign className="w-3 h-3" />
                          <span>Pendiente validación</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Inversión: €{rec.investment_month_min?.toLocaleString()}-{rec.investment_month_max?.toLocaleString()}/mes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{rec.difficulty}</Badge>
                      <Badge variant="outline" className="text-xs">{rec.implementation_time}</Badge>
                      <Badge variant="outline" className="text-xs">Confianza: {rec.confidence_display}</Badge>
                      {rec.effort_level && (
                        <Badge variant="outline" className={`text-xs ${effortBadge[rec.effort_level] || ""}`}>
                          Esfuerzo: {rec.effort_level}
                        </Badge>
                      )}
                      {rec.time_to_value && (
                        <Badge variant="outline" className={`text-xs ${ttvBadge[rec.time_to_value] || ""}`}>
                          Valor: {rec.time_to_value}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs opacity-60">{rec.estimation_source}</Badge>
                    </div>

                    {deps.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Requiere:</span>
                        {deps.map((dep, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-muted/30 font-mono">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
