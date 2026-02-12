import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, CheckCircle2, AlertTriangle, Lightbulb, Users, RefreshCw, TrendingUp, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WeeklySummaryData {
  headline: string;
  productivity_score: number;
  highlights: string[];
  open_threads: string[];
  key_people: string[];
  ideas_captured: string[];
  recommendation: string;
  stats: {
    transcriptions: number;
    tasks_completed: number;
    tasks_pending: number;
    commitments: number;
  };
}

export default function WeeklySummaryCard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requested, setRequested] = useState(false);

  const fetchSummary = async (sendWhatsApp = false) => {
    if (!user?.id) return;
    try {
      setRequested(true);
      if (summary) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase.functions.invoke("weekly-summary", {
        body: { send_whatsapp: sendWhatsApp },
      });

      if (error) throw error;
      if (data?.summary) setSummary(data.summary);
    } catch (err) {
      console.error("[WeeklySummary] Error:", err);
      toast.error("Error generando el resumen semanal");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (!requested) {
    return (
      <Card className="bg-gradient-to-br from-cyan-950/40 to-teal-950/30 border-cyan-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-200">
            <BarChart3 className="h-4 w-4" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Genera un resumen consolidado de tu semana: logros, pendientes, personas clave e ideas.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary()}
            className="border-cyan-700/50 text-cyan-200 hover:bg-cyan-900/30"
          >
            <BarChart3 className="h-3 w-3 mr-1" /> Generar resumen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-cyan-950/40 to-teal-950/30 border-cyan-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-200">
            <BarChart3 className="h-4 w-4" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4 bg-cyan-900/30" />
          <Skeleton className="h-12 w-full bg-cyan-900/30" />
          <Skeleton className="h-8 w-1/2 bg-cyan-900/30" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const scoreColor = summary.productivity_score >= 7
    ? "text-emerald-400"
    : summary.productivity_score >= 5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <Card className="bg-gradient-to-br from-cyan-950/40 to-teal-950/30 border-cyan-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-200">
            <BarChart3 className="h-4 w-4" />
            Resumen Semanal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${scoreColor} border-current text-xs`}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {summary.productivity_score}/10
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchSummary()} disabled={refreshing}>
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-green-400 hover:text-green-300"
              onClick={() => { fetchSummary(true); toast.success("Enviando por WhatsApp..."); }}
              title="Enviar por WhatsApp"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-cyan-100">{summary.headline}</p>

        {/* Stats row */}
        {summary.stats && (
          <div className="flex flex-wrap gap-2">
            {summary.stats.tasks_completed > 0 && (
              <Badge variant="secondary" className="text-xs bg-emerald-900/30 text-emerald-300">
                ✅ {summary.stats.tasks_completed} completadas
              </Badge>
            )}
            {summary.stats.tasks_pending > 0 && (
              <Badge variant="secondary" className="text-xs bg-orange-900/30 text-orange-300">
                ⏳ {summary.stats.tasks_pending} pendientes
              </Badge>
            )}
            {summary.stats.transcriptions > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-900/30 text-blue-300">
                🎙️ {summary.stats.transcriptions} transcripciones
              </Badge>
            )}
            {summary.stats.commitments > 0 && (
              <Badge variant="secondary" className="text-xs bg-purple-900/30 text-purple-300">
                🤝 {summary.stats.commitments} compromisos
              </Badge>
            )}
          </div>
        )}

        {/* Highlights */}
        {summary.highlights?.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
            <div className="text-emerald-200 space-y-0.5">
              {summary.highlights.map((h, i) => (
                <div key={i}>• {h}</div>
              ))}
            </div>
          </div>
        )}

        {/* Open threads */}
        {summary.open_threads?.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
            <div className="text-orange-200 space-y-0.5">
              {summary.open_threads.map((t, i) => (
                <div key={i}>• {t}</div>
              ))}
            </div>
          </div>
        )}

        {/* Key people */}
        {summary.key_people?.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <Users className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
            <span className="text-blue-200">{summary.key_people.join(", ")}</span>
          </div>
        )}

        {/* Ideas */}
        {summary.ideas_captured?.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-yellow-400 shrink-0" />
            <span className="text-yellow-200">{summary.ideas_captured.join(", ")}</span>
          </div>
        )}

        {/* Recommendation */}
        {summary.recommendation && (
          <div className="flex items-start gap-2 text-xs bg-cyan-900/20 rounded-md p-2 mt-1">
            <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-cyan-400 shrink-0" />
            <span className="text-cyan-100 italic">{summary.recommendation}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}