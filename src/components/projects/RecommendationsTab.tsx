import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, TrendingUp, DollarSign, Zap } from "lucide-react";
import type { Recommendation } from "@/hooks/useBusinessLeverage";

interface Props {
  recommendations: Recommendation[];
  hasDiagnostic: boolean;
  loading: boolean;
  onGenerate: () => Promise<void>;
}

const layerConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Quick Wins", color: "bg-green-500/10 text-green-400 border-green-500/30", emoji: "🟢" },
  2: { label: "Optimización Workflow", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", emoji: "🟡" },
  3: { label: "Ventaja Competitiva", color: "bg-orange-500/10 text-orange-400 border-orange-500/30", emoji: "🟠" },
  4: { label: "Nuevos Ingresos", color: "bg-red-500/10 text-red-400 border-red-500/30", emoji: "🔴" },
  5: { label: "Transformación", color: "bg-purple-500/10 text-purple-400 border-purple-500/30", emoji: "🟣" },
};

export const RecommendationsTab = ({ recommendations, hasDiagnostic, loading, onGenerate }: Props) => {
  if (!hasDiagnostic) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Genera la radiografía primero.</div>;
  }

  const grouped = [1, 2, 3, 4, 5].map(layer => ({
    layer,
    ...layerConfig[layer],
    items: recommendations.filter(r => r.layer === layer).sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)),
  })).filter(g => g.items.length > 0);

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
        <div className="flex justify-end">
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
            {group.items.map(rec => (
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
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <DollarSign className="w-3 h-3" />
                      <span>€{rec.revenue_impact_month_min}-{rec.revenue_impact_month_max}/mes</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Inversión: €{rec.investment_month_min}-{rec.investment_month_max}/mes</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{rec.difficulty}</Badge>
                    <Badge variant="outline" className="text-xs">{rec.implementation_time}</Badge>
                    <Badge variant="outline" className="text-xs">Confianza: {rec.confidence_display}</Badge>
                    <Badge variant="outline" className="text-xs opacity-60">{rec.estimation_source}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
