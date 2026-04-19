import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, RefreshCw, CalendarDays, ListTodo, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TomorrowBrief {
  headline: string;
  calendar_summary: string;
  task_focus: string;
  plaud_context: string;
  closing_note: string;
}

/**
 * Brief de mañana — solo se muestra después de las 20h locales.
 * Cachea por usuario+fecha en daily_briefs (scope = "tomorrow").
 */
export default function TomorrowBriefCard() {
  const { user } = useAuth();
  const [brief, setBrief] = useState<TomorrowBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isEvening = new Date().getHours() >= 20;

  const fetchBrief = async (force = false) => {
    if (!user?.id) return;
    try {
      force ? setRefreshing(true) : setLoading(true);
      const { data, error } = await supabase.functions.invoke("daily-context-brief", {
        body: { userId: user.id, scope: "tomorrow", force },
      });
      if (error) throw error;
      if (data?.brief) setBrief(data.brief);
    } catch (e) {
      console.error("[TomorrowBrief]", e);
      if (force) toast.error("No se pudo generar el brief de mañana");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isEvening) fetchBrief();
    else setLoading(false);
  }, [user?.id, isEvening]);

  // Solo aparece de noche o si ya hay un brief cacheado
  if (!isEvening && !brief) return null;

  return (
    <Card className="bg-gradient-to-br from-indigo-950/40 to-violet-950/30 border-indigo-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-200">
            <Moon className="h-4 w-4" />
            Mañana te toca
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fetchBrief(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-4 w-3/4 bg-indigo-900/30" />
            <Skeleton className="h-12 w-full bg-indigo-900/30" />
          </>
        ) : !brief ? (
          <p className="text-sm text-muted-foreground">Sin brief para mañana aún.</p>
        ) : (
          <>
            <p className="text-sm font-medium text-indigo-100">{brief.headline}</p>
            {brief.calendar_summary && (
              <div className="flex items-start gap-2 text-xs">
                <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                <span className="text-blue-200">{brief.calendar_summary}</span>
              </div>
            )}
            {brief.task_focus && (
              <div className="flex items-start gap-2 text-xs">
                <ListTodo className="h-3.5 w-3.5 mt-0.5 text-green-400 shrink-0" />
                <span className="text-green-200">{brief.task_focus}</span>
              </div>
            )}
            {brief.plaud_context && (
              <div className="flex items-start gap-2 text-xs">
                <Mic className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span className="text-foreground/80">{brief.plaud_context}</span>
              </div>
            )}
            {brief.closing_note && (
              <p className="text-xs italic text-indigo-300/80 pt-1 border-t border-indigo-800/30">
                {brief.closing_note}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
