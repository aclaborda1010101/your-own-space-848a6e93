import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface BuildRegistryPanelProps {
  projectId: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const BuildRegistryPanel = ({ projectId }: BuildRegistryPanelProps) => {
  const [loading, setLoading] = useState(false);
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

  const run = async () => {
    setLoading(true);
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
        body: JSON.stringify({ action: "build_registry", projectId }),
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

  const summary =
    parsed && typeof parsed === "object"
      ? {
          ok: parsed.ok,
          opportunity_count: parsed.opportunity_count,
          component_count: parsed.component_count,
          warnings_count: parsed.warnings_count ?? parsed.warnings?.length,
          validation_issues_count:
            parsed.validation_issues_count ?? parsed.validation_issues?.length,
          f2_ms: parsed.f2_ms,
          f3_ms: parsed.f3_ms,
        }
      : null;

  return (
    <Card className="border-accent/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">QA · Pipeline v2 — Build Registry (Step 25)</CardTitle>
            <CardDescription className="text-xs mt-1">
              Ejecuta <code className="font-mono text-[11px]">action: build_registry</code> sin aprobar el briefing. Útil
              para validar Step 25 end-to-end. Límite del Edge Function: 150 s.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <Badge variant="outline" className="text-[11px] font-mono">
                {elapsed}s / 150s
              </Badge>
            )}
            <Button onClick={run} disabled={loading} variant="holo" size="sm">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ejecutando…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Ejecutar build_registry
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {(status !== null || error || raw) && (
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">STATUS:</span>
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
                      <span className="text-foreground">{String(v)}</span>
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

export default BuildRegistryPanel;
