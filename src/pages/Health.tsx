import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useJarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import {
  Activity,
  Heart,
  Moon,
  Zap,
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
  BrainCircuit,
  Info
} from "lucide-react";

const Health = () => {
  const { isLoading, hasData, data, refetch } = useJarvisWhoopData();

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
            <p className="text-sm text-muted-foreground font-mono">
              MÉTRICAS WHOOP
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-4">Cargando...</p>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Info className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Sin datos disponibles
            </h2>
            <p className="text-muted-foreground">
              Conecta tu cuenta de Whoop para ver tus métricas de salud.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Recovery Card */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                Recuperación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-4xl font-bold">{data?.recovery_score ?? '—'}%</p>
                  <p className="text-sm text-muted-foreground">
                    Puntuación de recuperación
                  </p>
                </div>
                <Badge className={getRecoveryColor(data?.recovery_score ?? 0)}>{data?.recovery_score ?? '—'}</Badge>
              </div>
              <Progress value={data?.recovery_score ?? 0} className="mt-4" />
            </CardContent>
          </Card>

          {/* Strain Card */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-destructive" />
                Esfuerzo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-4xl font-bold">{data?.strain}</p>
                  <p className="text-sm text-muted-foreground">
                    Esfuerzo cardiovascular
                  </p>
                </div>
                <Badge className={getStrainColor(data?.strain ?? 0)}>{data?.strain}</Badge>
              </div>
              <Progress value={(data?.strain ?? 0) * 6.66} className="mt-4" />
            </CardContent>
          </Card>

          {/* Sleep Card */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-primary" />
                Sueño
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-4xl font-bold">{data?.sleep_performance}%</p>
                  <p className="text-sm text-muted-foreground">
                    Eficiencia del sueño
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    <Clock className="inline-block w-3 h-3 mr-1 align-text-bottom" />
                    {data?.sleep_hours}h sueño
                  </p>
                </div>
              </div>
              <Progress value={data?.sleep_performance ?? 0} className="mt-4" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Health;
