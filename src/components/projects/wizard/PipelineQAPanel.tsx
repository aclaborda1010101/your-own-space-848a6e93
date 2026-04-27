import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Copy, Check, FileText, FileBadge, ShieldCheck, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PipelineQAPanelProps {
  projectId: string;
}

type WizardAction =
  | "build_registry"
  | "audit_f4a_gaps"
  | "audit_f4b_feasibility"
  | "architect_scope"
  | "generate_technical_prd"
  | "generate_client_proposal"
  | "audit_final_deliverables"
  | "generate_lovable_build_pack";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ACTION_META: Record<WizardAction, { label: string; step: string; hint: number; variant: "outline" | "holo" }> = {
  build_registry: { label: "Build Registry", step: "Step 25", hint: 150, variant: "outline" },
  audit_f4a_gaps: { label: "F4a · Gap Audit", step: "Step 26", hint: 180, variant: "holo" },
  audit_f4b_feasibility: { label: "F4b · Feasibility", step: "Step 27", hint: 240, variant: "holo" },
  architect_scope: { label: "F5 · Scope Architect", step: "Step 28", hint: 180, variant: "holo" },
  generate_technical_prd: { label: "PRD técnico", step: "Step 29", hint: 30, variant: "outline" },
  generate_client_proposal: { label: "Propuesta cliente", step: "Step 30", hint: 30, variant: "outline" },
  audit_final_deliverables: { label: "Auditar entregables", step: "Step 31", hint: 30, variant: "outline" },
  generate_lovable_build_pack: { label: "Lovable Build Pack", step: "Step 32", hint: 15, variant: "outline" },
};

const DEFAULT_COMMERCIAL_TERMS = `{
  "pricing_model": "setup_plus_monthly",
  "setup_fee": 25000,
  "monthly_retainer": 4500,
  "currency": "EUR",
  "ai_usage_cost_policy": "Costes de IA y APIs externas facturados a coste según consumo real.",
  "payment_terms": "50% al inicio, 50% contra entrega del MVP. Mensualidades a mes vencido.",
  "timeline": "MVP en 12 semanas tras kickoff.",
  "validity_days": 30,
  "taxes": "IVA no incluido."
}`;

export const PipelineQAPanel = ({ projectId }: PipelineQAPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<WizardAction | null>(null);
  const [lastAction, setLastAction] = useState<WizardAction | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [parsed, setParsed] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [commercialTerms, setCommercialTerms] = useState<string>(DEFAULT_COMMERCIAL_TERMS);
  const [showTermsForm, setShowTermsForm] = useState(false);
  const startRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const startTicker = () => {
    startRef.current = Date.now();
    setElapsed(0);
    tickRef.current = window.setInterval(() => {
      if (startRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 250);
  };

  const stopTicker = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (startRef.current) {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }
  };

  // Acciones que requieren que Step 28 (architect_scope) ya exista.
  const REQUIRES_STEP_28: WizardAction[] = ["generate_technical_prd", "generate_client_proposal"];
  // Cadena previa necesaria para producir Step 28.
  const PREREQ_CHAIN: WizardAction[] = [
    "build_registry",
    "audit_f4a_gaps",
    "audit_f4b_feasibility",
    "architect_scope",
  ];

  const invokeAction = async (
    action: WizardAction,
    token: string,
    extraBody: Record<string, unknown> = {},
  ): Promise<{ status: number; text: string; parsed: any | null }> => {
    const url = `${SUPABASE_URL}/functions/v1/project-wizard-step`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ action, projectId, ...extraBody }),
    });
    const text = await res.text();
    let p: any = null;
    try { p = JSON.parse(text); } catch { /* noop */ }
    return { status: res.status, text, parsed: p };
  };

  const ensureStep28Exists = async (token: string): Promise<{ ok: boolean; error?: string }> => {
    const { data: step28 } = await supabase
      .from("project_wizard_steps")
      .select("id")
      .eq("project_id", projectId)
      .eq("step_number", 28)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (step28?.id) return { ok: true };

    // Step 28 no existe → ejecutar cadena previa F2/F3 → F4a → F4b → F5.
    for (const prereq of PREREQ_CHAIN) {
      setCurrentAction(prereq);
      startRef.current = Date.now();
      setElapsed(0);
      const { status, parsed: pr } = await invokeAction(prereq, token);
      if (status < 200 || status >= 300) {
        return {
          ok: false,
          error: `Falló paso previo "${ACTION_META[prereq].label}" (${status}): ${pr?.error || "error desconocido"}`,
        };
      }
    }
    return { ok: true };
  };

  const run = async (action: WizardAction) => {
    setLoading(true);
    setCurrentAction(action);
    setLastAction(action);
    setStatus(null);
    setRaw("");
    setParsed(null);
    setError(null);
    setCopied(false);
    startTicker();

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setError("No hay sesión activa. Inicia sesión y vuelve a intentar.");
        return;
      }

      // Auto-cadena: si la acción requiere Step 28 y no existe, ejecutar prereqs.
      if (REQUIRES_STEP_28.includes(action)) {
        const pre = await ensureStep28Exists(token);
        if (!pre.ok) {
          setError(pre.error || "No se pudo preparar Step 28.");
          return;
        }
        // Restaurar UI a la acción original solicitada por el usuario.
        setCurrentAction(action);
        startRef.current = Date.now();
        setElapsed(0);
      }

      const extraBody: Record<string, unknown> = {};
      if (action === "generate_client_proposal") {
        try {
          extraBody.stepData = { commercial_terms_v1: JSON.parse(commercialTerms) };
        } catch (e) {
          setError("commercial_terms no es JSON válido. Revisa el formulario.");
          return;
        }
      }

      const { status, text, parsed: p } = await invokeAction(action, token, extraBody);
      setStatus(status);
      setRaw(text);
      setParsed(p);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      stopTicker();
      setLoading(false);
      setCurrentAction(null);
    }
  };

  const downloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const statusTone =
    status == null
      ? "bg-muted text-muted-foreground"
      : status >= 200 && status < 300
      ? "bg-primary/15 text-primary border-primary/30"
      : status >= 400 && status < 500
      ? "bg-accent/15 text-accent border-accent/30"
      : "bg-destructive/15 text-destructive border-destructive/30";

  // Resumen adaptativo según la acción ejecutada
  const summary = (() => {
    if (!parsed || typeof parsed !== "object") return null;

    const audit = parsed.audit ?? {};

    // Step 32 — Lovable Build Pack
    if (lastAction === "generate_lovable_build_pack" || parsed.markdown) {
      return {
        ok: parsed.ok,
        version: parsed.version,
        word_count: parsed.word_count,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.length : 0,
        source_prd_row_id: parsed.source_prd_row_id,
        source_scope_row_id: parsed.source_scope_row_id,
      };
    }

    // Step 31 — final deliverables audit
    if (lastAction === "audit_final_deliverables" || parsed.deliverables_audit) {
      const a = parsed.deliverables_audit ?? parsed;
      return {
        ok: parsed.ok,
        passed: a.checks_passed ?? a.passed,
        failed: a.checks_failed ?? a.failed,
        warnings: a.warnings_count ?? a.warnings?.length,
        verdict: a.verdict ?? a.recommendation,
      };
    }

    // Step 30 — client proposal
    if (lastAction === "generate_client_proposal" || parsed.client_proposal) {
      const p = parsed.client_proposal ?? parsed;
      return {
        ok: parsed.ok,
        sections_count: p.sections?.length ?? p.sections_count,
        word_count: p.word_count,
        banned_phrases_found: p.banned_phrases_found ?? 0,
        version: p.version,
      };
    }

    // Step 29 — technical PRD
    if (lastAction === "generate_technical_prd" || parsed.technical_prd) {
      const p = parsed.technical_prd ?? parsed;
      return {
        ok: parsed.ok,
        components_count: p.components_count ?? p.components?.length,
        sections_count: p.sections?.length ?? p.sections_count,
        traceability_violations: p.traceability_violations ?? 0,
        version: p.version,
      };
    }

    // Step 27 (F4b) — feasibility
    if (
      lastAction === "audit_f4b_feasibility" ||
      audit.component_reviews ||
      parsed.recommended_next_step
    ) {
      const reviews = audit.component_reviews ?? parsed.component_reviews ?? [];
      const risks = audit.risks ?? parsed.risks ?? [];
      return {
        ok: parsed.ok,
        components_reviewed: Array.isArray(reviews) ? reviews.length : reviews,
        risks_count: Array.isArray(risks) ? risks.length : risks,
        recommended_next_step:
          audit.recommended_next_step ?? parsed.recommended_next_step,
        warnings_count: parsed.warnings_count ?? parsed.warnings?.length,
      };
    }

    // Step 26 (F4a) — gap audit
    if (
      lastAction === "audit_f4a_gaps" ||
      audit.gaps ||
      parsed.gaps_count !== undefined
    ) {
      const gaps = audit.gaps ?? parsed.gaps ?? [];
      const gapsArr = Array.isArray(gaps) ? gaps : [];
      return {
        ok: parsed.ok,
        gaps_count: parsed.gaps_count ?? gapsArr.length,
        critical_count:
          parsed.critical_count ??
          gapsArr.filter((g: any) => g?.severity === "critical").length,
        coverage_summary:
          audit.coverage_summary ?? parsed.coverage_summary ?? undefined,
        warnings_count: parsed.warnings_count ?? parsed.warnings?.length,
      };
    }

    // Step 25 (Build Registry) — default
    return {
      ok: parsed.ok,
      opportunity_count: parsed.opportunity_count,
      component_count: parsed.component_count,
      warnings_count: parsed.warnings_count ?? parsed.warnings?.length,
      validation_issues_count:
        parsed.validation_issues_count ?? parsed.validation_issues?.length,
      f2_ms: parsed.f2_ms,
      f3_ms: parsed.f3_ms,
    };
  })();

  // Markdown descargable según última acción
  const downloadableMarkdown = (() => {
    if (!parsed) return null;
    if (lastAction === "generate_technical_prd") {
      const md = parsed.technical_prd?.markdown ?? parsed.markdown;
      if (md) return { filename: "PRD-tecnico.md", content: md, label: "Descargar PRD (MD)" };
    }
    if (lastAction === "generate_client_proposal") {
      const md = parsed.client_proposal?.markdown ?? parsed.markdown;
      if (md) return { filename: "Propuesta-cliente.md", content: md, label: "Descargar Propuesta (MD)" };
    }
    if (lastAction === "generate_lovable_build_pack") {
      const md = parsed.markdown;
      if (md) return { filename: "Lovable-Build-Pack.md", content: md, label: "Descargar Build Pack (MD)" };
    }
    return null;
  })();

  const copyBuildPack = async () => {
    if (lastAction !== "generate_lovable_build_pack" || !parsed?.markdown) return;
    try {
      await navigator.clipboard.writeText(parsed.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const renderActionButton = (action: WizardAction) => {
    const meta = ACTION_META[action];
    const isThisRunning = loading && currentAction === action;
    return (
      <Button
        key={action}
        onClick={() => run(action)}
        disabled={loading}
        variant={meta.variant}
        size="sm"
      >
        {isThisRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ejecutando…
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            {meta.label} ({meta.step})
          </>
        )}
      </Button>
    );
  };

  return (
    <Card className="border-accent/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">QA · Pipeline v2 — Steps 25–32</CardTitle>
            <CardDescription className="text-xs mt-1">
              Pipeline interno (25–28), entregables finales (29 PRD · 30 Propuesta · 31 Auditoría) y operativo (32 Build Pack para Lovable).
              Tiempos típicos: Registry ~60–120s, F4a ~60–180s, F4b ~120–240s, F5 ~60–180s, PRD/Propuesta ~30–60s, Build Pack ~5–15s.
            </CardDescription>
          </div>
          {loading && currentAction && (
            <Badge variant="outline" className="text-[11px] font-mono">
              {ACTION_META[currentAction].label} · {elapsed}s / {ACTION_META[currentAction].hint}s
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-3">
          {renderActionButton("build_registry")}
          {renderActionButton("audit_f4a_gaps")}
          {renderActionButton("audit_f4b_feasibility")}
          {renderActionButton("architect_scope")}
        </div>

        <div className="border-t border-border/40 mt-3 pt-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Entregables finales
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => run("generate_technical_prd")}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading && currentAction === "generate_technical_prd" ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generando PRD…</>
              ) : (
                <><FileText className="w-4 h-4" />Generar PRD técnico (Step 29)</>
              )}
            </Button>
            <Button
              onClick={() => setShowTermsForm((v) => !v)}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {showTermsForm ? "Ocultar" : "Editar"} commercial_terms
            </Button>
            <Button
              onClick={() => run("generate_client_proposal")}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading && currentAction === "generate_client_proposal" ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generando propuesta…</>
              ) : (
                <><FileBadge className="w-4 h-4" />Generar Propuesta cliente (Step 30)</>
              )}
            </Button>
            <Button
              onClick={() => run("audit_final_deliverables")}
              disabled={loading}
              variant="ghost"
              size="sm"
            >
              {loading && currentAction === "audit_final_deliverables" ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Auditando…</>
              ) : (
                <><ShieldCheck className="w-4 h-4" />Auditar entregables (Step 31)</>
              )}
            </Button>
          </div>

          {showTermsForm && (
            <div className="space-y-1.5">
              <Label htmlFor="commercial-terms" className="text-xs text-muted-foreground">
                commercial_terms_v1 (JSON) — usado por Step 30
              </Label>
              <Textarea
                id="commercial-terms"
                value={commercialTerms}
                onChange={(e) => setCommercialTerms(e.target.value)}
                rows={12}
                className="font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </CardHeader>

      {(status !== null || error || raw) && (
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {lastAction ? `${ACTION_META[lastAction].label} · STATUS:` : "STATUS:"}
            </span>
            <Badge variant="outline" className={cn("font-mono text-xs", statusTone)}>
              {status ?? "—"}
            </Badge>
            {!loading && elapsed > 0 && (
              <span className="text-[11px] text-muted-foreground font-mono">
                · duración {elapsed}s
              </span>
            )}
            {downloadableMarkdown && (
              <Button
                onClick={() => downloadMarkdown(downloadableMarkdown.filename, downloadableMarkdown.content)}
                variant="holo"
                size="sm"
                className="ml-auto h-7 text-xs"
              >
                <FileText className="w-3 h-3" />
                {downloadableMarkdown.label}
              </Button>
            )}
            {raw && (
              <Button
                onClick={copyRaw}
                variant="outline"
                size="sm"
                className={cn("h-7 text-xs", !downloadableMarkdown && "ml-auto")}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado" : "Copiar RAW"}
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-mono break-all">
              {error}
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Resumen
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                {Object.entries(summary).map(([k, v]) =>
                  v === undefined ? null : (
                    <div key={k} className="flex justify-between gap-2 border-b border-border/30 pb-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground break-all text-right">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {raw && (
            <details className="rounded-lg border border-border/50 bg-muted/20" open>
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground select-none">
                RAW response ({raw.length} chars)
              </summary>
              <pre className="px-3 pb-3 pt-1 text-[11px] font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-auto text-muted-foreground">
                {raw}
              </pre>
            </details>
          )}

          {parsed && (
            <details className="rounded-lg border border-border/50 bg-muted/20">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground select-none">
                JSON parseado
              </summary>
              <pre className="px-3 pb-3 pt-1 text-[11px] font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-auto text-muted-foreground">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default PipelineQAPanel;
