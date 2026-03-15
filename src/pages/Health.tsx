import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWhoop } from "@/hooks/useWhoop";
import { useWhoopHistory } from "@/hooks/useWhoopHistory";
import { RecoveryChart } from "@/components/health/RecoveryChart";
import { SleepChart } from "@/components/health/SleepChart";
import { StrainChart } from "@/components/health/StrainChart";
import { HrvChart } from "@/components/health/HrvChart";
import { HealthAISummary } from "@/components/health/HealthAISummary";
import {
  Activity, Heart, Moon, Zap, TrendingUp, RefreshCw,
  Loader2, Clock, Info, Link, Unlink,
} from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
];

const Health = () => {
  const { isConnected, isLoading, isFetching, data, connect, disconnect, fetchData } = useWhoop();
  const [period, setPeriod] = useState(7);
  const { history, isLoading: historyLoading } = useWhoopHistory(period);

  const getRecoveryColor = (recovery: number) => {
    if (recovery >= 67) return "text-success";
    if (recovery >= 34) return "text-warning";
    return "text-destructive";
  };

  const getStrainColor = (strain: number) => {
    if (strain >= 14) return "text-destructive";
    if (strain >= 10) return "text-warning";
    return "text-success";
  };

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
              <Button variant="outline" size="icon" onClick={fetchData} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect} className="gap-2 text-destructive">
                <Unlink className="w-4 h-4" />
                Desconectar
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
              <Link className="w-4 h-4" />
              Conectar WHOOP
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">WHOOP conectado</h2>
            <p className="text-muted-foreground">
              Tu cuenta está conectada pero aún no hay datos disponibles. Pulsa actualizar para sincronizar.
            </p>
            <Button onClick={fetchData} disabled={isFetching} className="gap-2">
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar datos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Today's Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Zap className="w-4 h-4 mx-auto text-warning mb-1" />
                <p className="text-2xl font-bold">{data.recovery_score ?? '—'}%</p>
                <p className="text-[10px] text-muted-foreground">Recuperación</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <TrendingUp className="w-4 h-4 mx-auto text-destructive mb-1" />
                <p className="text-2xl font-bold">{data.strain ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">Strain</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Moon className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{data.sleep_performance ?? '—'}%</p>
                <p className="text-[10px] text-muted-foreground">Sueño</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Heart className="w-4 h-4 mx-auto text-destructive mb-1" />
                <p className="text-2xl font-bold">{data.hrv ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">HRV (ms)</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card col-span-2 sm:col-span-1">
              <CardContent className="p-3 text-center">
                <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{data.sleep_hours?.toFixed(1) ?? '—'}h</p>
                <p className="text-[10px] text-muted-foreground">Horas sueño</p>
              </CardContent>
            </Card>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Periodo:</span>
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={period === opt.value ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Charts */}
          {history.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-warning" />
                    Recuperación
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <RecoveryChart data={history} />
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-primary" />
                    Sueño
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <SleepChart data={history} />
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-destructive" />
                    Esfuerzo (Strain)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <StrainChart data={history} />
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-destructive" />
                    HRV & FC Reposo
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
                No hay datos históricos para el periodo seleccionado. Sincroniza más días.
              </CardContent>
            </Card>
          ) : null}

          {/* AI Summary */}
          <HealthAISummary />
        </>
      )}
    </div>
  );
};

export default Health;
