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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity, Heart, Moon, Zap, TrendingUp, RefreshCw,
  Loader2, Info, Link, Unlink, Thermometer, Wind,
  Droplets, Timer, BedDouble, Brain, Flame, ChevronUp, ChevronDown,
  CalendarIcon, ChevronLeft, ChevronRight, Download,
} from "lucide-react";

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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shadow-lg shadow-success/30">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Salud</h1>
            <p className="text-sm text-muted-foreground font-mono">MÉTRICAS WHOOP</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isConnected && (
            <>
              <Button variant="outline" size="sm" onClick={() => backfillHistory(30)} disabled={isBackfilling} className="gap-1.5 text-xs">
                {isBackfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Cargar 30d
              </Button>
              <Button variant="outline" size="icon" onClick={fetchData} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect} className="gap-2 text-destructive">
                <Unlink className="w-4 h-4" /> Desconectar
              </Button>
            </>
          )}
        </div>
      </div>

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
              {/* Top Summary: 3 circles */}
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${data.sleep_performance != null && data.sleep_performance >= 70 ? "border-primary" : data.sleep_performance != null && data.sleep_performance >= 40 ? "border-warning" : "border-muted"}`}>
                    <span className="text-xl font-bold">{data.sleep_performance ?? "—"}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wide">Sueño</p>
                </div>
                <div className="text-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${getRecoveryBadgeColor(data.recovery_score)} border-opacity-80`}>
                    <span className="text-2xl font-bold">{data.recovery_score ?? "—"}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wide">Recuperación</p>
                </div>
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${data.strain != null && data.strain >= 14 ? "border-destructive" : data.strain != null && data.strain >= 10 ? "border-warning" : "border-muted"}`}>
                    <span className="text-xl font-bold">{data.strain?.toFixed(1) ?? "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wide">Esfuerzo</p>
                </div>
              </div>

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
