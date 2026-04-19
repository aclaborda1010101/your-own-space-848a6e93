import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWhoop, WhoopData } from "@/hooks/useWhoop";
import { useWhoopHistory } from "@/hooks/useWhoopHistory";
import { RecoveryChart } from "@/components/health/RecoveryChart";
import { SleepChart } from "@/components/health/SleepChart";
import { StrainChart } from "@/components/health/StrainChart";
import { HrvChart } from "@/components/health/HrvChart";
import { HealthAISummary } from "@/components/health/HealthAISummary";
import { HealthRecommendationCard } from "@/components/health/HealthRecommendationCard";
import { HealthMetricRing } from "@/components/health/HealthMetricRing";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity, Heart, Moon, Zap, TrendingUp, RefreshCw,
  Loader2, Info, Link, Unlink, Thermometer, Wind,
  Droplets, Timer, BedDouble, Brain, Flame, ChevronUp, ChevronDown,
  CalendarIcon, ChevronLeft, ChevronRight, Download, Sparkles,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

const PERIOD_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const MetricRow = ({ icon: Icon, label, value, unit, trend, color }: {
  icon: any; label: string; value: string | number | null; unit?: string; trend?: "up" | "down" | null; color?: string;
}) => (
  <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg">
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-lg font-bold text-foreground">{value ?? "—"}</span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      {trend === "up" && <ChevronUp className="w-3 h-3 text-success" />}
      {trend === "down" && <ChevronDown className="w-3 h-3 text-destructive" />}
    </div>
  </div>
);

const formatTime = (hours: number | null) => {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

const getRecoveryBadgeColor = (r: number | null) => {
  if (r == null) return "bg-muted";
  if (r >= 67) return "bg-success";
  if (r >= 34) return "bg-warning";
  return "bg-destructive";
};

const getStrainLabel = (s: number | null) => {
  if (s == null) return "—";
  if (s >= 18) return "All Out";
  if (s >= 14) return "Alto";
  if (s >= 10) return "Moderado";
  return "Ligero";
};

const Health = () => {
  const {
    isConnected, isLoading, isFetching, isBackfilling,
    data, selectedDate, availableDates,
    connect, disconnect, fetchData, backfillHistory, changeDate,
  } = useWhoop();
  const [period, setPeriod] = useState(7);
  const { history, isLoading: historyLoading } = useWhoopHistory(period);

  const goDay = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    if (newDate <= new Date()) changeDate(newDate);
  };

  const availableDateSet = new Set(availableDates);
  const isToday = selectedDate.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];

  const recoveryScore = data?.recovery_score ?? null;
  const recoveryTone: "success" | "warning" | "destructive" =
    recoveryScore == null ? "warning" :
    recoveryScore >= 67 ? "success" :
    recoveryScore >= 34 ? "warning" : "destructive";
  const recoveryLabel =
    recoveryScore == null ? "Sin datos" :
    recoveryScore >= 67 ? "En verde, listo" :
    recoveryScore >= 34 ? "Moderado" : "En rojo, descansa";

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHero
        eyebrow={`WHOOP · ${format(selectedDate, "EEE d MMM", { locale: es })}`}
        eyebrowIcon={<Activity className="w-3 h-3" />}
        title={
          <>
            Tu <span className="italic font-serif text-primary">salud</span>{" "}
            de hoy
          </>
        }
        subtitle={
          recoveryScore != null
            ? `Recuperación al ${recoveryScore}% — ${recoveryLabel.toLowerCase()}.`
            : "Conecta tu WHOOP para ver tus métricas en tiempo real."
        }
        tone={recoveryTone === "destructive" ? "warning" : recoveryTone}
        actions={
          isConnected && (
            <>
              <Button variant="outline" size="sm" onClick={() => backfillHistory(30)} disabled={isBackfilling} className="gap-1.5 text-xs rounded-full">
                {isBackfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Cargar 30d
              </Button>
              <Button variant="outline" size="icon" onClick={fetchData} disabled={isFetching} className="rounded-full">
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect} className="gap-2 text-destructive rounded-full">
                <Unlink className="w-4 h-4" /> Desconectar
              </Button>
            </>
          )
        }
        stats={
          isConnected && data
            ? [
                {
                  label: "Recuperación",
                  value: recoveryScore != null ? `${recoveryScore}%` : "—",
                  hint: recoveryLabel,
                  icon: <Zap className="w-4 h-4" />,
                  tone: recoveryTone === "destructive" ? "destructive" : recoveryTone,
                },
                {
                  label: "Sueño",
                  value: data.sleep_hours != null ? formatTime(data.sleep_hours) : "—",
                  hint: "horas dormidas",
                  icon: <Moon className="w-4 h-4" />,
                  tone: "accent",
                },
                {
                  label: "Esfuerzo",
                  value: data.strain != null ? data.strain.toFixed(1) : "—",
                  hint: `${getStrainLabel(data.strain)} / 21`,
                  icon: <TrendingUp className="w-4 h-4" />,
                  tone: "warning",
                },
                {
                  label: "HRV",
                  value: data.hrv != null ? `${data.hrv}` : "—",
                  hint: "ms (var. cardiaca)",
                  icon: <Heart className="w-4 h-4" />,
                  tone: "primary",
                },
              ]
            : undefined
        }
      />


      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-4">Cargando...</p>
          </CardContent>
        </Card>
      ) : !isConnected ? (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Link className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Conecta tu WHOOP</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Vincula tu cuenta de WHOOP para sincronizar automáticamente tus métricas de recuperación, sueño y esfuerzo.
            </p>
            <Button onClick={connect} className="gap-2">
              <Link className="w-4 h-4" /> Conectar WHOOP
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Date picker bar */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goDay(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm h-9">
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, "EEE d MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && changeDate(d)}
                  disabled={(date) => date > new Date()}
                  modifiers={{ hasData: (date) => availableDateSet.has(date.toISOString().split("T")[0]) }}
                  modifiersClassNames={{ hasData: "bg-primary/20 font-bold" }}
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goDay(1)} disabled={isToday}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => changeDate(new Date())}>
                Hoy
              </Button>
            )}
          </div>

          {!data ? (
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Info className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Sin datos para este día</h2>
                <p className="text-muted-foreground">
                  No hay datos de WHOOP disponibles. Sincroniza o carga el histórico.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={fetchData} disabled={isFetching} className="gap-2">
                    {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sincronizar
                  </Button>
                  <Button variant="outline" onClick={() => backfillHistory(30)} disabled={isBackfilling} className="gap-2">
                    {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Cargar 30 días
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* HERO: Recuperación gigante con color dinámico */}
              <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-background p-6 sm:p-10 text-center">
                <div
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background:
                      recoveryScore == null
                        ? "radial-gradient(circle at 50% 30%, hsl(var(--muted) / 0.4), transparent 60%)"
                        : recoveryScore >= 67
                        ? "radial-gradient(circle at 50% 30%, hsl(var(--success) / 0.35), transparent 60%)"
                        : recoveryScore >= 34
                        ? "radial-gradient(circle at 50% 30%, hsl(var(--warning) / 0.35), transparent 60%)"
                        : "radial-gradient(circle at 50% 30%, hsl(var(--destructive) / 0.4), transparent 60%)",
                  }}
                  aria-hidden
                />
                <p className="relative text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                  Recuperación
                </p>
                <p
                  className={cn(
                    "relative font-serif italic font-light tabular-nums leading-none",
                    "text-7xl sm:text-8xl",
                    recoveryScore == null
                      ? "text-muted-foreground"
                      : recoveryScore >= 67
                      ? "text-success"
                      : recoveryScore >= 34
                      ? "text-warning"
                      : "text-destructive"
                  )}
                  style={{
                    textShadow:
                      recoveryScore == null
                        ? "none"
                        : recoveryScore >= 67
                        ? "0 0 30px hsl(var(--success) / 0.5)"
                        : recoveryScore >= 34
                        ? "0 0 30px hsl(var(--warning) / 0.5)"
                        : "0 0 30px hsl(var(--destructive) / 0.5)",
                  }}
                >
                  {recoveryScore != null ? `${recoveryScore}` : "—"}
                  <span className="text-4xl sm:text-5xl ml-1 opacity-70">%</span>
                </p>
                <p className="relative mt-4 text-sm sm:text-base italic text-muted-foreground max-w-xs mx-auto">
                  {recoveryScore == null
                    ? "Sin datos de recuperación hoy."
                    : recoveryScore >= 67
                    ? "Listo para empujar. Aprovecha el día."
                    : recoveryScore >= 34
                    ? "Equilibrio frágil. Modera la intensidad."
                    : "Estás en rojo. Prioriza descanso y recuperación."}
                </p>
              </div>

              {/* Métricas circulares neon: Sueño · Esfuerzo · HRV */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 justify-items-center">
                <HealthMetricRing
                  percent={data.sleep_performance}
                  value={data.sleep_performance != null ? `${data.sleep_performance}%` : "—"}
                  label="Sueño"
                  tone={
                    data.sleep_performance != null && data.sleep_performance >= 70
                      ? "primary"
                      : data.sleep_performance != null && data.sleep_performance >= 40
                      ? "warning"
                      : "destructive"
                  }
                  hint="rendimiento"
                  size="md"
                />
                <HealthMetricRing
                  percent={data.strain != null ? Math.min(100, (data.strain / 21) * 100) : null}
                  value={data.strain != null ? data.strain.toFixed(1) : "—"}
                  label="Esfuerzo"
                  tone={
                    data.strain != null && data.strain >= 14
                      ? "destructive"
                      : data.strain != null && data.strain >= 10
                      ? "warning"
                      : "success"
                  }
                  hint={`/ 21`}
                  size="md"
                />
                <HealthMetricRing
                  percent={data.hrv != null ? Math.min(100, (data.hrv / 120) * 100) : null}
                  value={data.hrv != null ? `${data.hrv}` : "—"}
                  label="HRV"
                  tone="accent"
                  hint="ms"
                  size="md"
                />
              </div>

              {/* Recomendación contextual LLM (Whoop + tareas + comida) */}
              <HealthRecommendationCard />

              {data.data_date && (
                <p className="text-center text-xs text-muted-foreground">
                  Datos del {new Date(data.data_date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                </p>
              )}

              {/* RECOVERY Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-success" /> Recuperación
                </h3>
                <div className="space-y-1.5">
                  <MetricRow icon={Zap} label="Recuperación" value={data.recovery_score != null ? `${data.recovery_score}%` : null} color="text-success" />
                  <MetricRow icon={Heart} label="HRV" value={data.hrv} unit="ms" color="text-destructive" />
                  <MetricRow icon={Heart} label="FC Reposo" value={data.resting_hr} unit="bpm" color="text-destructive" />
                  <MetricRow icon={Droplets} label="SpO2" value={data.spo2 != null ? `${data.spo2.toFixed(1)}%` : null} color="text-primary" />
                  <MetricRow icon={Thermometer} label="Temp. Cutánea" value={data.skin_temp != null ? `${data.skin_temp.toFixed(1)}°` : null} color="text-warning" />
                  <MetricRow icon={Wind} label="Frec. Respiratoria" value={data.respiratory_rate != null ? data.respiratory_rate.toFixed(1) : null} unit="rpm" color="text-primary" />
                </div>
              </div>

              {/* STRAIN Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-warning" /> Esfuerzo
                </h3>
                <div className="space-y-1.5">
                  <MetricRow icon={TrendingUp} label="Strain" value={data.strain?.toFixed(1) ?? null} unit={`/ 21 (${getStrainLabel(data.strain)})`} color="text-warning" />
                  <MetricRow icon={Flame} label="Calorías" value={data.calories} unit="kcal" color="text-destructive" />
                  <MetricRow icon={Heart} label="FC Media" value={data.avg_hr} unit="bpm" color="text-destructive" />
                  <MetricRow icon={Heart} label="FC Máxima" value={data.max_hr} unit="bpm" color="text-destructive" />
                </div>
              </div>

              {/* SLEEP Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Moon className="w-4 h-4 text-primary" /> Sueño
                </h3>
                <div className="space-y-1.5">
                  <MetricRow icon={Moon} label="Calificación Sueño" value={data.sleep_performance != null ? `${data.sleep_performance}%` : null} color="text-primary" />
                  <MetricRow icon={BedDouble} label="Tiempo en Cama" value={formatTime(data.time_in_bed_hours)} color="text-muted-foreground" />
                  <MetricRow icon={Moon} label="Horas Dormido" value={formatTime(data.time_asleep_hours)} color="text-primary" />
                  <MetricRow icon={Timer} label="Eficiencia Sueño" value={data.sleep_efficiency != null ? `${data.sleep_efficiency.toFixed(0)}%` : null} color="text-success" />
                  <MetricRow icon={Timer} label="Regularidad Sueño" value={data.sleep_consistency != null ? `${data.sleep_consistency.toFixed(0)}%` : null} color="text-success" />
                  <MetricRow icon={Timer} label="Latencia" value={data.sleep_latency_min != null ? `${data.sleep_latency_min.toFixed(0)}` : null} unit="min" color="text-muted-foreground" />
                  <MetricRow icon={Brain} label="Sueño Necesario" value={formatTime(data.sleep_need_hours)} color="text-warning" />
                  <MetricRow icon={Brain} label="Deuda de Sueño" value={formatTime(data.sleep_debt_hours)} color="text-destructive" />
                </div>
              </div>

              {/* Sleep Stages */}
              {(data.deep_sleep_hours != null || data.rem_sleep_hours != null) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" /> Fases del Sueño
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Card className="border-border bg-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{formatTime(data.deep_sleep_hours)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Profundo (SWS)</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{formatTime(data.rem_sleep_hours)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">REM</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{formatTime(data.light_sleep_hours)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Ligero</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{formatTime(data.awake_hours)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Despierto</p>
                        {data.disturbances != null && (
                          <p className="text-[9px] text-muted-foreground">{data.disturbances} despertares</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Period selector + Charts */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tendencias:</span>
                {PERIOD_OPTIONS.map(opt => (
                  <Button key={opt.value} size="sm" variant={period === opt.value ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod(opt.value)}>
                    {opt.label}
                  </Button>
                ))}
                {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-warning" /> Esfuerzo y Recuperación
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <RecoveryChart data={history} />
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-primary" /> Sueño
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <SleepChart data={history} />
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-destructive" /> Esfuerzo (Strain)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <StrainChart data={history} />
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-destructive" /> HRV & FC Reposo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <HrvChart data={history} />
                    </CardContent>
                  </Card>
                </div>
              ) : !historyLoading ? (
                <Card className="border-border bg-card">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No hay datos históricos. Pulsa "Cargar 30d" para importar tu historial de WHOOP.
                  </CardContent>
                </Card>
              ) : null}

              {/* AI Summary */}
              <HealthAISummary />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Health;
