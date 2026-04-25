import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Copy, Check, FileText, FileBadge, ShieldCheck } from "lucide-react";
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
  | "audit_final_deliverables";

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

      const url = `${SUPABASE_URL}/functions/v1/project-wizard-step`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ action, projectId }),
      });

      setStatus(res.status);
      const text = await res.text();
      setRaw(text);
      try {
        setParsed(JSON.parse(text));
      } catch {
        setParsed(null);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      stopTicker();
      setLoading(false);
      setCurrentAction(null);
    }
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
            <CardTitle className="text-base">QA · Pipeline v2 — Steps 25 / 26 / 27 / 28</CardTitle>
            <CardDescription className="text-xs mt-1">
              Lanza acciones del wizard sin tocar consola. Tiempos típicos: Build Registry ~60–120s,
              F4a ~60–180s (Flash), F4b ~120–240s (Pro), F5 ~60–180s (Pro).
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
            {raw && (
              <Button onClick={copyRaw} variant="outline" size="sm" className="ml-auto h-7 text-xs">
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
