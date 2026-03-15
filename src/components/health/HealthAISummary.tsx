import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Brain, RefreshCw, Loader2, Moon, Zap, Heart,
  AlertTriangle, TrendingUp, TrendingDown, Minus, Bell, BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission, scheduleHealthNotification } from "@/utils/healthNotifications";

interface HealthSummary {
  estado_general: string;
  puntuacion_global: number;
  recuperacion: { promedio: number; tendencia: string; mejor_dia: string; peor_dia: string };
  sueno: {
    horas_promedio: number; eficiencia_promedio: number;
    deep_sleep_pct: number; rem_pct: number;
    latencia_promedio_min: number; deuda_actual_horas: number;
    hora_ideal_acostarse: string; hora_ideal_despertar: string;
    tendencia: string;
  };
  esfuerzo: { strain_promedio: number; calorias_promedio: number; nivel: string; recomendacion_hoy: string };
  cardiovascular: { hrv_promedio: number; hrv_tendencia: string; rhr_promedio: number; rhr_tendencia: string };
  alertas: string[];
  consejos: { tipo: string; mensaje: string; prioridad: string; hora_notificacion?: string }[];
  resumen_texto: string;
  notas_sistema: string;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend.includes("mejorando") || trend.includes("subiendo")) return <TrendingUp className="w-3 h-3 text-success" />;
  if (trend.includes("deteriorando") || trend.includes("bajando")) return <TrendingDown className="w-3 h-3 text-destructive" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const estadoColors: Record<string, string> = {
  óptimo: "bg-success text-success-foreground",
  bueno: "bg-success/80 text-success-foreground",
  moderado: "bg-warning text-warning-foreground",
  bajo: "bg-destructive/80 text-destructive-foreground",
  crítico: "bg-destructive text-destructive-foreground",
};

export const HealthAISummary = () => {
  const { user, session } = useAuth();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    setNotificationsEnabled("Notification" in window && Notification.permission === "granted");
  }, []);

  const loadSummary = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("jarvis_memory")
      .select("content, updated_at, metadata")
      .eq("user_id", user.id)
      .eq("category", "health_summary")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      try {
        const parsed = JSON.parse(data.content);
        setSummary(parsed);
      } catch {
        setSummary(null);
      }
      setLastUpdated(data.updated_at);
    }
  }, [user]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const generateSummary = async () => {
    if (!session?.access_token) return;
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("whoop-health-summary", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (result.summary) {
        setSummary(result.summary);
        setLastUpdated(new Date().toISOString());
      } else {
        await loadSummary();
      }
      toast.success("Resumen de salud actualizado");
    } catch (err: any) {
      console.error(err);
      toast.error("Error generando resumen de salud");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted && summary?.consejos) {
        for (const consejo of summary.consejos) {
          if (consejo.hora_notificacion) {
            scheduleHealthNotification(consejo.mensaje, consejo.hora_notificacion);
          }
        }
        toast.success("Notificaciones de salud activadas");
      }
    } else {
      setNotificationsEnabled(false);
      toast.info("Notificaciones desactivadas");
    }
  };

  if (!summary) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-primary" /> Análisis IA
            </CardTitle>
            <Button variant="outline" size="sm" onClick={generateSummary} disabled={isLoading} className="gap-1">
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Generar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pulsa "Generar" para crear un análisis inteligente con consejos personalizados basados en tus datos de WHOOP.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Score + Estado */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{summary.puntuacion_global}</span>
              </div>
              <div>
                <Badge className={estadoColors[summary.estado_general] || "bg-muted"}>
                  {summary.estado_general?.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">{summary.resumen_texto}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={toggleNotifications} className="h-8 w-8">
                {notificationsEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={generateSummary} disabled={isLoading} className="h-8 w-8">
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground">
              Actualizado: {new Date(lastUpdated).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mini metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-success" />
              <span className="text-[10px] uppercase text-muted-foreground">Recovery</span>
              <TrendIcon trend={summary.recuperacion.tendencia} />
            </div>
            <span className="text-lg font-bold">{summary.recuperacion.promedio}%</span>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Moon className="w-3 h-3 text-primary" />
              <span className="text-[10px] uppercase text-muted-foreground">Sueño</span>
              <TrendIcon trend={summary.sueno.tendencia} />
            </div>
            <span className="text-lg font-bold">{summary.sueno.horas_promedio}h</span>
            <span className="text-xs text-muted-foreground ml-1">({summary.sueno.eficiencia_promedio}% eff)</span>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Heart className="w-3 h-3 text-destructive" />
              <span className="text-[10px] uppercase text-muted-foreground">HRV</span>
              <TrendIcon trend={summary.cardiovascular.hrv_tendencia} />
            </div>
            <span className="text-lg font-bold">{summary.cardiovascular.hrv_promedio}ms</span>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-warning" />
              <span className="text-[10px] uppercase text-muted-foreground">Strain</span>
            </div>
            <span className="text-lg font-bold">{summary.esfuerzo.strain_promedio}</span>
            <span className="text-xs text-muted-foreground ml-1">/ 21</span>
          </CardContent>
        </Card>
      </div>

      {/* Recomendación del día + sueño */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Recomendación hoy</p>
            <p className="text-sm font-medium text-foreground">{summary.esfuerzo.recomendacion_hoy}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Hora ideal de sueño</p>
            <p className="text-sm font-medium text-foreground">
              🛏️ {summary.sueno.hora_ideal_acostarse} → ⏰ {summary.sueno.hora_ideal_despertar}
              {summary.sueno.deuda_actual_horas > 0 && (
                <span className="text-xs text-destructive ml-2">(deuda: {summary.sueno.deuda_actual_horas}h)</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {summary.alertas && summary.alertas.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 space-y-1.5">
            {summary.alertas.map((alerta, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">{alerta}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Consejos */}
      {summary.consejos && summary.consejos.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Consejos personalizados</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {summary.consejos.map((consejo, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                  {consejo.tipo}
                </Badge>
                <p className="text-xs text-foreground flex-1">{consejo.mensaje}</p>
                {consejo.hora_notificacion && (
                  <span className="text-[9px] text-muted-foreground shrink-0">🔔 {consejo.hora_notificacion}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
