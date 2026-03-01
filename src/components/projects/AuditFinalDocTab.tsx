import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import type { QuestionItem, Diagnostic, Recommendation, Roadmap } from "@/hooks/useBusinessLeverage";

interface Props {
  auditId: string;
  auditName?: string;
  questionnaire: QuestionItem[] | null;
  responses: Record<string, any>;
  diagnostic: Diagnostic | null;
  recommendations: Recommendation[];
  roadmap: Roadmap | null;
  loading: boolean;
}

export const AuditFinalDocTab = ({
  auditId, auditName, questionnaire, responses, diagnostic, recommendations, roadmap, loading,
}: Props) => {
  const [generating, setGenerating] = useState(false);

  const phases = [
    { label: "Cuestionario", done: !!questionnaire && Object.keys(responses).length > 0 },
    { label: "Radiografía", done: !!diagnostic },
    { label: "Plan por Capas", done: recommendations.length > 0 },
    { label: "Roadmap", done: !!roadmap },
  ];

  const allDone = phases.every(p => p.done);

  const buildFullMarkdown = () => {
    const parts: string[] = [];

    // Questionnaire
    if (questionnaire) {
      parts.push("# 1. Cuestionario\n");
      questionnaire.forEach((q, i) => {
        const answer = responses[q.id];
        const answerStr = Array.isArray(answer) ? answer.join(", ") : (answer ?? "Sin respuesta");
        parts.push(`### ${i + 1}. ${q.question}\n**Respuesta:** ${answerStr}\n`);
      });
    }

    // Diagnostic
    if (diagnostic) {
      parts.push("\n# 2. Radiografía del Negocio\n");
      parts.push(`- **Madurez Digital**: ${diagnostic.digital_maturity_score}/100`);
      parts.push(`- **Automatización**: ${diagnostic.automation_level}/100`);
      parts.push(`- **Data Readiness**: ${diagnostic.data_readiness}/100`);
      parts.push(`- **Oportunidad IA**: ${diagnostic.ai_opportunity_score}/100\n`);

      const findings = [
        { label: "Procesos manuales", items: diagnostic.manual_processes },
        { label: "Fugas de tiempo", items: diagnostic.time_leaks },
        { label: "Dependencias de personas", items: diagnostic.person_dependencies },
        { label: "Cuellos de botella", items: diagnostic.bottlenecks },
        { label: "Quick Wins", items: diagnostic.quick_wins },
      ];
      findings.filter(f => f.items?.length > 0).forEach(f => {
        parts.push(`## ${f.label}`);
        f.items.forEach((item: string) => parts.push(`- ${item}`));
        parts.push("");
      });
    }

    // Recommendations
    if (recommendations.length > 0) {
      parts.push("\n# 3. Plan por Capas\n");
      [1, 2, 3, 4, 5].forEach(layer => {
        const items = recommendations.filter(r => r.layer === layer);
        if (items.length === 0) return;
        const labels: Record<number, string> = { 1: "Quick Wins", 2: "Optimización Workflow", 3: "Ventaja Competitiva", 4: "Nuevos Ingresos", 5: "Transformación" };
        parts.push(`## Capa ${layer} — ${labels[layer]}`);
        items.forEach(r => {
          parts.push(`### ${r.title}`);
          parts.push(r.description || "");
          parts.push(`- Tiempo ahorrado: ${r.time_saved_hours_week_min}-${r.time_saved_hours_week_max}h/sem`);
          parts.push(`- Productividad: +${r.productivity_uplift_pct_min}-${r.productivity_uplift_pct_max}%`);
          parts.push(`- Dificultad: ${r.difficulty} · ${r.implementation_time}`);
          parts.push("");
        });
      });
    }

    // Roadmap
    if (roadmap?.full_document_md) {
      parts.push("\n# 4. Roadmap\n");
      parts.push(roadmap.full_document_md);
    }

    return parts.join("\n");
  };

  const handleExportMd = () => {
    const md = buildFullMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-ia-completa.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateDocx = async () => {
    setGenerating(true);
    try {
      const md = buildFullMarkdown();
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          projectId: auditId,
          stepNumber: 10,
          content: md,
          contentType: "markdown",
          projectName: auditName || "Auditoría IA",
          company: "",
          version: "v1",
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Documento DOCX generado");
      }
    } catch (e: any) {
      toast.error("Error generando documento: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground">ESTADO DE FASES</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {phases.map(p => (
            <div key={p.label} className="flex items-center gap-2">
              {p.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm text-foreground">{p.label}</span>
              {p.done && <Badge variant="outline" className="text-xs ml-auto">Completada</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExportMd} disabled={!allDone} className="gap-1">
          <Download className="w-4 h-4" /> Exportar todo MD
        </Button>
        <Button onClick={handleGenerateDocx} disabled={!allDone || generating || loading} className="gap-1">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generar Documento DOCX
        </Button>
      </div>

      {!allDone && (
        <p className="text-xs text-muted-foreground">
          Completa las 4 fases para generar el documento final consolidado.
        </p>
      )}
    </div>
  );
};
