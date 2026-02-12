import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, ListChecks, AlertTriangle, Sparkles, RefreshCw, Target, FileText, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EveningBriefingData {
  greeting: string;
  summary: string;
  day_review: string;
  transcriptions_summary: string;
  open_threads: string[];
  tomorrow_preview: string;
  energy_note: string;
  motivation: string;
  day_score: number;
}

export default function EveningBriefingCard() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<EveningBriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requested, setRequested] = useState(false);

  const fetchBriefing = async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase.functions.invoke("daily-briefing", {
        body: { userId: user.id, type: "evening" },
      });

      if (error) throw error;

      if (data?.briefing?.full_content) {
        setBriefing(data.briefing.full_content);
      }
    } catch (err) {
      console.error("[EveningBriefing] Error:", err);
      toast.error("Error cargando el briefing nocturno");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Check if it's evening (after 18:00)
  const isEvening = new Date().getHours() >= 18;

  if (!requested && !briefing) {
    return (
      <Card className="bg-gradient-to-br from-indigo-950/40 to-violet-950/30 border-indigo-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-200">
            <Moon className="h-4 w-4" />
            Briefing Nocturno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            {isEvening ? "Genera tu resumen del día." : "Disponible a partir de las 18:00."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRequested(true); fetchBriefing(); }}
            className="border-indigo-700/50 text-indigo-200 hover:bg-indigo-900/30"
          >
            <Moon className="h-3 w-3 mr-1" /> Generar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-950/40 to-violet-950/30 border-indigo-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-200">
            <Moon className="h-4 w-4" />
            Briefing Nocturno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4 bg-indigo-900/30" />
          <Skeleton className="h-12 w-full bg-indigo-900/30" />
          <Skeleton className="h-8 w-1/2 bg-indigo-900/30" />
        </CardContent>
      </Card>
    );
  }

  if (!briefing) return null;

  const scoreColor = (briefing.day_score || 0) >= 7
    ? "text-emerald-400"
    : (briefing.day_score || 0) >= 5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <Card className="bg-gradient-to-br from-indigo-950/40 to-violet-950/30 border-indigo-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-200">
            <Moon className="h-4 w-4" />
            Briefing Nocturno
          </CardTitle>
          <div className="flex items-center gap-2">
            {briefing.day_score && (
              <Badge variant="outline" className={`${scoreColor} border-current text-xs`}>
                <Target className="h-3 w-3 mr-1" />
                {briefing.day_score}/10
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchBriefing(true)} disabled={refreshing}>
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-indigo-100">{briefing.greeting}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{briefing.summary}</p>

        {briefing.day_review && (
          <div className="flex items-start gap-2 text-xs">
            <ListChecks className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-200">{briefing.day_review}</span>
          </div>
        )}

        {briefing.transcriptions_summary && (
          <div className="flex items-start gap-2 text-xs">
            <FileText className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
            <span className="text-blue-200">{briefing.transcriptions_summary}</span>
          </div>
        )}

        {briefing.open_threads?.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
            <div className="text-orange-200">
              {briefing.open_threads.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {briefing.tomorrow_preview && (
          <p className="text-xs text-indigo-300">🔮 {briefing.tomorrow_preview}</p>
        )}

        {briefing.motivation && (
          <div className="flex items-start gap-2 text-xs bg-indigo-900/20 rounded-md p-2 mt-1">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-indigo-400 shrink-0" />
            <span className="text-indigo-100 italic">{briefing.motivation}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
