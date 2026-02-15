import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWhoop } from "@/hooks/useWhoop";
import { cn } from "@/lib/utils";
import {
  Activity, Heart, Moon, Zap, TrendingUp, RefreshCw, Loader2, Clock, BrainCircuit, Info, Link2, Unlink
} from "lucide-react";

const Health = () => {
  const { isConnected, isLoading, isFetching, data, connect, disconnect, fetchData } = useWhoop();

  const getRecoveryColor = (recovery: number) => {
    if (recovery >= 67) return "text-success";
    if (recovery >= 34) return "text-warning";
    return "text-destructive";
  };
  const getRecoveryBgColor = (recovery: number) => {
    if (recovery >= 67) return "bg-success";
    if (recovery >= 34) return "bg-warning";
    return "bg-destructive";
  };
  const getRecoveryLabel = (recovery: number) => {
    if (recovery >= 67) return "VERDE";
    if (recovery >= 34) return "AMARILLO";
    return "ROJO";
  };
  const getStrainColor = (strain: number) => {
    if (strain >= 14) return "text-destructive";
    if (strain >= 10) return "text-warning";
    return "text-success";
  };

  const hasData = data !== null && (data.recovery_score !== null || data.hrv !== null || data.strain !== null);

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
              <Button variant="outline" size="sm" onClick={fetchData} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Sincronizar
              </Button>
              <Button variant="ghost" size="sm" onClick={disconnect}>
                <Unlink className="w-4 h-4 mr-1" />
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
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Conectar WHOOP</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Conecta tu cuenta de WHOOP para ver tus métricas de recovery, strain, HRV y sueño.
            </p>
            <Button onClick={connect} size="lg" className="gap-2">
              <Link2 className="w-5 h-5" />
              Conectar WHOOP
            </Button>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">WHOOP Conectado</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Tu cuenta está conectada. Sincroniza para obtener tus datos más recientes.
            </p>
            <Button onClick={fetchData} disabled={isFetching} size="lg" className="gap-2">
              {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              Sincronizar datos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-success/30 bg-gradient-to-br from-success/10 to-transparent overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono mb-1">RECOVERY SCORE</p>
                  <div className="flex items-baseline gap-2">
                    {data?.recovery_score !== null ? (
                      <>
                        <span className={cn("text-6xl font-bold", getRecoveryColor(data.recovery_score!))}>{data.recovery_score}%</span>
                        <Badge className={cn("text-white", getRecoveryBgColor(data.recovery_score!))}>{getRecoveryLabel(data.recovery_score!)}</Badge>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-muted-foreground">--</span>
                    )}
                  </div>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-success/30 flex items-center justify-center">
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center", data?.recovery_score !== null ? getRecoveryBgColor(data.recovery_score!) : "bg-muted")}>
                    <Heart className="w-10 h-10 text-white" />
                  </div>
                </div>
              </div>
              {data?.recovery_score !== null && <Progress value={data.recovery_score!} className="h-2 mt-4" />}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-card"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground font-mono">HRV</span></div><p className="text-3xl font-bold text-foreground">{data?.hrv ?? "--"}</p><p className="text-xs text-muted-foreground">ms</p></CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Zap className={cn("w-4 h-4", data?.strain !== null ? getStrainColor(data.strain!) : "text-muted-foreground")} /><span className="text-xs text-muted-foreground font-mono">STRAIN</span></div><p className={cn("text-3xl font-bold", data?.strain !== null ? getStrainColor(data.strain!) : "text-foreground")}>{data?.strain?.toFixed(1) ?? "--"}</p><p className="text-xs text-muted-foreground">/ 21.0</p></CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Moon className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground font-mono">SUEÑO</span></div><p className="text-3xl font-bold text-foreground">{data?.sleep_hours?.toFixed(1) ?? "--"}</p><p className="text-xs text-muted-foreground">horas</p></CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Heart className="w-4 h-4 text-destructive" /><span className="text-xs text-muted-foreground font-mono">FC REPOSO</span></div><p className="text-3xl font-bold text-foreground">{data?.resting_hr ?? "--"}</p><p className="text-xs text-muted-foreground">bpm</p></CardContent></Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-5 h-5 text-primary" />Tendencia Semanal</CardTitle></CardHeader>
            <CardContent><div className="h-48 flex items-center justify-center border border-dashed border-border rounded-lg"><p className="text-sm text-muted-foreground">Gráfico de evolución semanal</p></div></CardContent>
          </Card>

          {data?.fetched_at && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />Última sincronización: {new Date(data.fetched_at).toLocaleString("es-ES")}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Health;
