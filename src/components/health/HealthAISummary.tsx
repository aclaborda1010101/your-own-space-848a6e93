import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Brain, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const HealthAISummary = () => {
  const { user, session } = useAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("jarvis_memory")
      .select("content, updated_at")
      .eq("user_id", user.id)
      .eq("category", "health_summary")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSummary(data.content);
      setLastUpdated(data.updated_at);
    }
  }, [user]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const generateSummary = async () => {
    if (!session?.access_token) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whoop-health-summary", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      await loadSummary();
      toast.success("Resumen de salud actualizado");
    } catch (err: any) {
      console.error(err);
      toast.error("Error generando resumen de salud");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Resumen IA
          </CardTitle>
          <Button variant="outline" size="sm" onClick={generateSummary} disabled={isLoading} className="gap-1">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Generar
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Actualizado: {new Date(lastUpdated).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {summary}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pulsa "Generar" para crear un resumen inteligente basado en tus datos de WHOOP. Este resumen será utilizado por la IA del sistema para adaptar sus recomendaciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
