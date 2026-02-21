import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, FileText, Download } from "lucide-react";
import type { Roadmap } from "@/hooks/useBusinessLeverage";

interface Props {
  roadmap: Roadmap | null;
  hasRecommendations: boolean;
  loading: boolean;
  onGenerate: () => Promise<void>;
}

export const RoadmapTab = ({ roadmap, hasRecommendations, loading, onGenerate }: Props) => {
  if (!hasRecommendations) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Genera las recomendaciones primero.</div>;
  }

  if (!roadmap) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-4">Genera el roadmap vendible basado en diagnóstico y recomendaciones.</p>
        <Button onClick={onGenerate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generar Roadmap
        </Button>
      </div>
    );
  }

  const handleExport = () => {
    if (!roadmap.full_document_md) return;
    const blob = new Blob([roadmap.full_document_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roadmap-v${roadmap.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const economic = roadmap.economic_impact as any;
  const pricing = roadmap.pricing_recommendation as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Versión {roadmap.version}</Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="w-4 h-4" /> Exportar MD
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Regenerar
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      {roadmap.executive_summary && (
        <Card className="border-border bg-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-primary">RESUMEN EJECUTIVO</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{roadmap.executive_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Economic Impact */}
      {economic && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tiempo ahorrado", value: economic.time_saved_range },
            { label: "Productividad", value: economic.productivity_range },
            { label: "Ingresos", value: economic.revenue_range },
            { label: "ROI", value: economic.roi_range },
          ].map(m => (
            <Card key={m.label} className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground font-mono">{m.label.toUpperCase()}</p>
                <p className="text-sm font-bold text-primary mt-1">{m.value || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plans */}
      {[
        { label: "QUICK WINS (14-30 días)", data: roadmap.quick_wins_plan as any[] },
        { label: "PLAN 90 DÍAS", data: roadmap.plan_90_days as any[] },
        { label: "PLAN 12 MESES", data: roadmap.plan_12_months as any[] },
      ].filter(p => p.data?.length > 0).map(plan => (
        <Card key={plan.label} className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">{plan.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.data.map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/10">
                <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.timeline && <p className="text-xs text-muted-foreground">{item.timeline}</p>}
                  {item.impact && <p className="text-xs text-primary">{item.impact}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Pricing */}
      {pricing && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">PRICING RECOMENDADO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Tier</p>
                <p className="text-sm font-medium text-foreground capitalize">{pricing.recommended_tier?.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Setup</p>
                <p className="text-sm font-medium text-foreground">{pricing.setup_range || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mensual</p>
                <p className="text-sm font-medium text-primary">{pricing.monthly_range || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Document */}
      {roadmap.full_document_md && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">DOCUMENTO COMPLETO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm prose-invert max-w-none text-foreground text-sm whitespace-pre-wrap">
              {roadmap.full_document_md}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
