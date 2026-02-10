import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Calendar, ListChecks, AlertTriangle, Sparkles, RefreshCw, Zap, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BriefingData {
  greeting: string;
  summary: string;
  calendar_summary: string;
  task_priorities: string;
  alerts: string;
  motivation: string;
  energy_recommendation: string;
  day_score_prediction: number;
}

export default function MorningBriefingCard() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase.functions.invoke("daily-briefing", {
        body: { userId: user.id },
      });

      if (error) throw error;

      if (data?.briefing?.full_content) {
        setBriefing(data.briefing.full_content);
      } else if (data?.briefing) {
        setBriefing(data.briefing);
      }
    } catch (err) {
      console.error("[MorningBriefing] Error:", err);
      toast.error("Error cargando el briefing matutino");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [user?.id]);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border-amber-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-200">
            <Sun className="h-4 w-4" />
            Briefing Matutino
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4 bg-amber-900/30" />
          <Skeleton className="h-12 w-full bg-amber-900/30" />
          <Skeleton className="h-8 w-1/2 bg-amber-900/30" />
        </CardContent>
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border-amber-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-200">
            <Sun className="h-4 w-4" />
            Briefing Matutino
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay briefing disponible</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchBriefing(true)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Generar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = (briefing.day_score_prediction || 0) >= 7
    ? "text-green-400"
    : (briefing.day_score_prediction || 0) >= 5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <Card className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border-amber-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-200">
            <Sun className="h-4 w-4" />
            Briefing Matutino
          </CardTitle>
          <div className="flex items-center gap-2">
            {briefing.day_score_prediction && (
              <Badge variant="outline" className={`${scoreColor} border-current text-xs`}>
                <Target className="h-3 w-3 mr-1" />
                {briefing.day_score_prediction}/10
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchBriefing(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Greeting */}
        <p className="text-sm font-medium text-amber-100">{briefing.greeting}</p>

        {/* Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed">{briefing.summary}</p>

        {/* Calendar */}
        {briefing.calendar_summary && (
          <div className="flex items-start gap-2 text-xs">
            <Calendar className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
            <span className="text-blue-200">{briefing.calendar_summary}</span>
          </div>
        )}

        {/* Tasks */}
        {briefing.task_priorities && (
          <div className="flex items-start gap-2 text-xs">
            <ListChecks className="h-3.5 w-3.5 mt-0.5 text-green-400 shrink-0" />
            <span className="text-green-200">{briefing.task_priorities}</span>
          </div>
        )}

        {/* Alerts */}
        {briefing.alerts && (
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
            <span className="text-orange-200">{briefing.alerts}</span>
          </div>
        )}

        {/* Energy Recommendation */}
        {briefing.energy_recommendation && (
          <div className="flex items-start gap-2 text-xs">
            <Zap className="h-3.5 w-3.5 mt-0.5 text-yellow-400 shrink-0" />
            <span className="text-yellow-200">{briefing.energy_recommendation}</span>
          </div>
        )}

        {/* Motivation */}
        {briefing.motivation && (
          <div className="flex items-start gap-2 text-xs bg-amber-900/20 rounded-md p-2 mt-1">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
            <span className="text-amber-100 italic">{briefing.motivation}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
