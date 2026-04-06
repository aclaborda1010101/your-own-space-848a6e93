import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { FileText, Loader2, Download, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepData {
  stepNumber: number;
  outputData: any;
  status: string;
  version?: number;
}

interface ProjectProposalExportProps {
  projectId: string;
  projectName: string;
  company: string;
  steps: StepData[];
  budgetData: any;
}

// ══════════════════════════════════════════════════════════════
// PRD simplification — strip ALL technical content for client
// ══════════════════════════════════════════════════════════════

function simplifyPrd(prdMarkdown: string): string {
  if (!prdMarkdown) return "";

  // 1. Strip [[INTERNAL_ONLY]]...[[/INTERNAL_ONLY]] blocks first
  let text = prdMarkdown.replace(
    /\[\[INTERNAL_ONLY\]\][\s\S]*?\[\[\/INTERNAL_ONLY\]\]/g,
    ""
  );

  // 2. Strip [HIPÓTESIS] / [HIPOTESIS] tags
  text = text.replace(/\[HIP[OÓ]TESIS\]/gi, "");

  // 3. Strip [[PENDING:*]] and [[NEEDS_CLARIFICATION:*]] tags
  text = text.replace(/\[\[PENDING:[^\]]*\]\]/g, "________________");
  text = text.replace(/\[\[NEEDS_CLARIFICATION:[^\]]*\]\]/g, "[Por confirmar]");
  text = text.replace(/\[\[NO_APLICA:[^\]]*\]\]/g, "");

  // 4. Remove ALL code blocks (```anything ... ```)
  text = text.replace(/```[\s\S]*?```/g, "");

  // 5. Remove all mentions of "Lovable"
  text = text.replace(/\bLovable[\s.-]*(?:dev|ready|Build|Blueprint)?\b/gi, "");
  text = text.replace(/copy[\s-]*paste\s+en\s+Lovable/gi, "");

  // 6. Split by headings and filter technical sections
  const lines = text.split("\n");
  const result: string[] = [];
  let skip = false;

  const skipPatterns = [
    /SQL/i, /Edge\s*Function/i, /migration/i, /Blueprint/i,
    /Esquema\s*SQL/i, /CREATE\s*TABLE/i, /cadencia/i, /cron/i,
    /Low[\s-]*Level/i, /Checklist\s*P[012]/i,
    /RLS/i, /Row[\s.-]*Level[\s.-]*Security/i,
    /hook/i, /useState|useEffect/i,
    /PostgreSQL/i, /trigger\b/i, /\bschema\b/i,
    /Mermaid/i, /Deno/i, /TypeScript/i,
    /catálogo.*variables/i, /interface\s+\w+/i,
    /API\s*endpoint/i, /Supabase/i,
    /LOVABLE/i, /Blueprint\s*Lovable/i,
    /Signal\s*Object/i, /Processing\s*Cloud/i,
  ];

  for (const line of lines) {
    const isHeading = /^#{1,3}\s/.test(line);
    if (isHeading) {
      skip = skipPatterns.some((p) => p.test(line));
    }
    if (!skip) {
      result.push(line);
    } else if (isHeading && !skipPatterns.some((p) => p.test(line))) {
      skip = false;
      result.push(line);
    }
  }

  return result.join("\n");
}

// ══════════════════════════════════════════════════════════════
// Sanitize aiOpportunities — remove internal metadata
// ══════════════════════════════════════════════════════════════

function sanitizeAiOpportunities(data: any): any {
  if (!data || typeof data !== "object") return data;

  // Remove top-level internal keys
  const internalKeys = new Set([
    "parse_error", "raw_response", "raw_text", "_score",
    "_internal", "_debug", "_meta", "_tokens",
  ]);

  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_") || internalKeys.has(key)) continue;
    cleaned[key] = value;
  }

  // If it has opportunities array, clean each item too
  if (Array.isArray(cleaned.opportunities)) {
    cleaned.opportunities = cleaned.opportunities.map((opp: any) => {
      const cleanOpp: any = {};
      for (const [k, v] of Object.entries(opp)) {
        if (!k.startsWith("_") && !internalKeys.has(k)) {
          cleanOpp[k] = v;
        }
      }
      return cleanOpp;
    });
  }

  return cleaned;
}

// ══════════════════════════════════════════════════════════════
// Sanitize budget — remove internal pricing fields
// ══════════════════════════════════════════════════════════════

function sanitizeBudgetForClient(
  budgetData: any,
  selectedModels: number[]
): any {
  const models = budgetData?.monetization_models || [];

  const filteredModels = models
    .filter((_: any, i: number) => selectedModels.includes(i))
    .map((m: any) => {
      const { your_margin_pct, _score, ...rest } = m;
      return rest;
    });

  // Strip ALL internal fields from development
  const {
    your_cost_eur,
    margin_pct,
    hourly_rate_eur,
    total_hours,
    ...devRest
  } = budgetData.development || {};

  return {
    development: devRest,
    recurring_monthly: budgetData.recurring_monthly,
    monetization_models: filteredModels,
    recommended_model: budgetData.recommended_model,
  };
}

export const ProjectProposalExport = ({
  projectId,
  projectName,
  company,
  steps,
  budgetData,
}: ProjectProposalExportProps) => {
  const [generating, setGenerating] = useState(false);
  const [generatingSimple, setGeneratingSimple] = useState(false);
  const [selectedModels, setSelectedModels] = useState<number[]>(
    budgetData?.monetization_models?.map((_: any, i: number) => i) || []
  );

  const models = budgetData?.monetization_models || [];

  const toggleModel = (idx: number) => {
    setSelectedModels((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const buildPayload = (stepNumber: number) => {
    const step3 = steps.find((s) => s.stepNumber === 3);
    const step4 = steps.find((s) => s.stepNumber === 4);
    const step5 = steps.find((s) => s.stepNumber === 5);

    const scope =
      step3?.outputData?.document ||
      (typeof step3?.outputData === "string" ? step3.outputData : "");

    const aiOpportunities = sanitizeAiOpportunities(step4?.outputData || null);

    const prdRaw =
      step5?.outputData?.document ||
      (typeof step5?.outputData === "string" ? step5.outputData : "");
    const techSummary = simplifyPrd(prdRaw);

    const budget = sanitizeBudgetForClient(budgetData, selectedModels);

    return {
      projectId,
      stepNumber,
      content: {
        scope,
        aiOpportunities: stepNumber === 100 ? aiOpportunities : undefined,
        techSummary,
        budget,
      },
      contentType: "json",
      projectName: projectName || "Proyecto",
      company,
      date: new Date().toISOString().split("T")[0],
      version: "v1",
      exportMode: "client",
    };
  };

  const downloadFile = async (data: any, defaultName: string) => {
    if (!data?.url) throw new Error("No download URL returned");
    const response = await fetch(data.url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = data.fileName || defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleGenerate = async () => {
    if (selectedModels.length === 0) {
      toast.error("Selecciona al menos un modelo de monetización");
      return;
    }
    setGenerating(true);
    try {
      const payload = buildPayload(100);
      const { data, error } = await supabase.functions.invoke(
        "generate-document",
        { body: payload }
      );
      if (error) throw error;
      await downloadFile(data, `propuesta-${projectName || "proyecto"}.pdf`);
      toast.success("Propuesta completa descargada");
    } catch (err: any) {
      console.error("Proposal export error:", err);
      toast.error(
        "Error al generar propuesta: " + (err.message || "Error desconocido")
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSimple = async () => {
    if (selectedModels.length === 0) {
      toast.error("Selecciona al menos un modelo de monetización");
      return;
    }
    setGeneratingSimple(true);
    try {
      const payload = buildPayload(101);
      const { data, error } = await supabase.functions.invoke(
        "generate-document",
        { body: payload }
      );
      if (error) throw error;
      await downloadFile(data, `propuesta-comercial-${projectName || "proyecto"}.pdf`);
      toast.success("Propuesta comercial descargada");
    } catch (err: any) {
      console.error("Commercial proposal export error:", err);
      toast.error(
        "Error al generar propuesta: " + (err.message || "Error desconocido")
      );
    } finally {
      setGeneratingSimple(false);
    }
  };

  return (
    <CollapsibleCard
      id="proposal-export"
      title="Propuesta para el Cliente"
      icon={<FileText className="w-4 h-4 text-primary" />}
      defaultOpen={false}
      badge={
        <Badge
          variant="outline"
          className="text-[10px] px-2 py-0 border-primary/30 text-primary bg-primary/5"
        >
          DOCUMENTO UNIFICADO
        </Badge>
      }
    >
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Genera documentos PDF profesionales para enviar al cliente: una propuesta comercial
          completa (hasta 10 páginas) con descripción del producto, alcance, fases, timings y
          presupuesto, o una propuesta técnica detallada con toda la información.
        </p>

        {models.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Modelos de monetización a incluir
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {models.map((m: any, i: number) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                    selectedModels.includes(i)
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <Checkbox
                    checked={selectedModels.includes(i)}
                    onCheckedChange={() => toggleModel(i)}
                    className="shrink-0"
                  />
                  <span className="text-foreground font-medium">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleGenerateSimple}
            disabled={generatingSimple || selectedModels.length === 0}
            variant="outline"
            className="gap-2 flex-1"
          >
            {generatingSimple ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando propuesta...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Propuesta Comercial (máx 10 págs)
              </>
            )}
          </Button>

          <Button
            onClick={handleGenerate}
            disabled={generating || selectedModels.length === 0}
            className="gap-2 flex-1"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando propuesta...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Propuesta Completa
              </>
            )}
          </Button>
        </div>
      </div>
    </CollapsibleCard>
  );
};
