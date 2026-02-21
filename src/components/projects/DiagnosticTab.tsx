import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Lightbulb, Database } from "lucide-react";
import type { Diagnostic } from "@/hooks/useBusinessLeverage";

interface Props {
  diagnostic: Diagnostic | null;
}

const scoreColor = (v: number) =>
  v >= 70 ? "text-green-400" : v >= 40 ? "text-yellow-400" : "text-red-400";

/** Split a finding string into description and quantification parts */
function splitFinding(text: string): { desc: string; quant: string | null } {
  // Look for patterns like "Impacto estimado:", "Ahorro estimado:", "Oportunidad estimada:", "Reducción estimada:", "Requiere datos"
  const quantPatterns = [
    /\.\s*((?:Impacto|Ahorro|Oportunidad|Reducción|Coste|Ingreso)\s+estimad[oa]:.+)$/i,
    /\.\s*(Requiere datos del negocio.+)$/i,
    /\.\s*(Fuente:.+)$/i,
  ];
  for (const pattern of quantPatterns) {
    const match = text.match(pattern);
    if (match) {
      const quantStart = text.lastIndexOf(match[1]);
      return {
        desc: text.substring(0, quantStart).replace(/\.\s*$/, "."),
        quant: match[1],
      };
    }
  }
  return { desc: text, quant: null };
}

export const DiagnosticTab = ({ diagnostic }: Props) => {
  if (!diagnostic) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Pulsa "Generar radiografía" en la pestaña Cuestionario para analizar las respuestas.
      </div>
    );
  }

  const scores = [
    { label: "Digital Maturity", value: diagnostic.digital_maturity_score ?? 0 },
    { label: "Automation Level", value: diagnostic.automation_level ?? 0 },
    { label: "Data Readiness", value: diagnostic.data_readiness ?? 0 },
    { label: "AI Opportunity", value: diagnostic.ai_opportunity_score ?? 0 },
  ];

  const findings = [
    { label: "Procesos manuales", items: diagnostic.manual_processes as string[], icon: AlertTriangle, color: "text-red-400" },
    { label: "Fugas de tiempo", items: diagnostic.time_leaks as string[], icon: AlertTriangle, color: "text-orange-400" },
    { label: "Dependencias de personas", items: diagnostic.person_dependencies as string[], icon: AlertTriangle, color: "text-yellow-400" },
    { label: "Cuellos de botella", items: diagnostic.bottlenecks as string[], icon: AlertTriangle, color: "text-red-400" },
    { label: "Quick Wins", items: diagnostic.quick_wins as string[], icon: Lightbulb, color: "text-green-400" },
    { label: "Herramientas infrautilizadas", items: diagnostic.underused_tools as string[], icon: Lightbulb, color: "text-blue-400" },
  ].filter(f => f.items?.length > 0);

  const dataGaps = (diagnostic.data_gaps || []) as { gap: string; impact: string; unlocks: string }[];

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        {scores.map(s => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-mono mb-2">{s.label.toUpperCase()}</p>
              <div className="flex items-center gap-3">
                <Progress value={s.value} className="flex-1 h-2" />
                <span className={`text-lg font-bold font-mono ${scoreColor(s.value)}`}>{s.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">HALLAZGOS CRÍTICOS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {findings.map(f => (
              <div key={f.label}>
                <p className={`text-xs font-mono mb-1 flex items-center gap-1 ${f.color}`}>
                  <f.icon className="w-3 h-3" /> {f.label.toUpperCase()}
                </p>
                <ul className="space-y-2">
                  {f.items.map((item, i) => {
                    const { desc, quant } = splitFinding(item);
                    return (
                      <li key={i} className="pl-4 relative before:absolute before:left-1 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-muted-foreground/30">
                        <p className="text-sm text-foreground">{desc}</p>
                        {quant && (
                          <p className="text-xs text-primary/80 mt-0.5 italic">{quant}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Gaps */}
      {dataGaps.length > 0 && (
        <Card className="border-border bg-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-primary flex items-center gap-2">
              <Database className="w-4 h-4" /> DATA GAPS — OPORTUNIDADES OCULTAS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataGaps.map((gap, i) => (
              <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium text-foreground">{gap.gap}</p>
                <p className="text-xs text-muted-foreground mt-1">Impacto: {gap.impact}</p>
                <p className="text-xs text-primary mt-1">Desbloquea: {gap.unlocks}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
