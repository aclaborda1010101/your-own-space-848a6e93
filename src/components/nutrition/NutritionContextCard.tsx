import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const NutritionContextCard = () => {
  const { user } = useAuth();
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!user) return;
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("daily-context-brief", {
        body: { scope: "nutrition", force },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      setContent((data as any).content);
      setGeneratedAt((data as any).generated_at);
      if (force) toast.success("Análisis nutricional actualizado");
    } catch (e: any) {
      const msg = e?.message || "No se pudo generar el análisis";
      setError(msg);
      if (force) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(false); }, [load]);

  return (
    <Card className="relative overflow-hidden border-success/20 bg-gradient-to-br from-success/5 via-card/80 to-primary/5">
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-success/10 blur-3xl pointer-events-none" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/15 border border-success/30 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Análisis nutricional
                <Sparkles className="w-3 h-3 text-success" />
              </h3>
              {generatedAt && !loading && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  Generado {formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Regenerar
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : content ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{content}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sin análisis disponible.</p>
        )}
      </CardContent>
    </Card>
  );
};
