import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const ExecutiveSummaryCard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!user) return;
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        force ? "jarvis-executive-summary?force=true" : "jarvis-executive-summary",
      );
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSummary((data as any).summary);
      setGeneratedAt((data as any).generated_at);
      if (force) toast.success("Resumen actualizado");
    } catch (e: any) {
      const msg = e?.message || "No se pudo generar el resumen";
      setError(msg);
      if (force) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(false); }, [load]);

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card/80 to-accent/5">
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-mono uppercase tracking-widest text-primary font-semibold">
                Resumen ejecutivo
              </h3>
              {generatedAt && !loading && (
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  Generado {formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-muted-foreground hover:text-primary"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            title="Regenerar resumen"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : summary ? (
          <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {summary}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sin datos suficientes para resumir el día.</p>
        )}
      </CardContent>
    </Card>
  );
};
