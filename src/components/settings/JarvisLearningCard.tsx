import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useJarvisLearning } from "@/hooks/useJarvisLearning";
import { Brain, Check, X, AlertTriangle, TrendingUp, Loader2, Sparkles } from "lucide-react";

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  healthy: { label: "Saludable", cls: "bg-success/15 text-success border-success/30" },
  warning: { label: "Atención", cls: "bg-warning/15 text-warning border-warning/30" },
  degraded: { label: "Degradado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

const PATTERN_LABEL: Record<string, string> = {
  priority_boost: "Prioridad aprendida",
  classification_hint: "Few-shot Plaud",
  suggestion_threshold: "Umbral ajustado",
};

export const JarvisLearningCard = () => {
  const { patterns, health, stats, loading, confirmPattern, rejectPattern } = useJarvisLearning();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando aprendizaje...
      </div>
    );
  }

  const pending = patterns.filter((p) => p.status === "pending");
  const confirmed = patterns.filter((p) => p.status === "confirmed");

  return (
    <div className="space-y-4">
      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label="Aceptadas" value={stats.accepted} icon={<Check className="h-4 w-4 text-success" />} />
        <StatBox label="Descartadas" value={stats.rejected} icon={<X className="h-4 w-4 text-destructive" />} />
        <StatBox label="Correcciones" value={stats.corrections} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        <StatBox
          label="Tasa acierto"
          value={`${Math.round(stats.acceptanceRate * 100)}%`}
          icon={<Sparkles className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* Patrones pendientes de confirmar */}
      {pending.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Patrones detectados ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Badge variant="outline" className="text-[10px]">
                      {PATTERN_LABEL[p.pattern_type] || p.pattern_type}
                    </Badge>
                    <p className="text-xs text-foreground">{p.description || p.pattern_key}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Evidencia: {p.evidence_count}</span>
                      <span>·</span>
                      <span>Confianza: {Math.round(p.confidence * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="default" className="h-7 px-2" onClick={() => confirmPattern(p.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => rejectPattern(p.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Patrones ya aplicados */}
      {confirmed.length > 0 && (() => {
        const autoCount = confirmed.filter(
          (p) => p.pattern_type === "classification_hint" && p.evidence_count >= 5 && p.confidence >= 0.85,
        ).length;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-success" /> Aprendido y aplicado ({confirmed.length})
                {autoCount > 0 && (
                  <Badge className="text-[10px] bg-success/15 text-success border-success/30 ml-auto">
                    {autoCount} auto-asignación{autoCount !== 1 ? "es" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {confirmed.slice(0, 12).map((p) => {
                const isAuto =
                  p.pattern_type === "classification_hint" && p.evidence_count >= 5 && p.confidence >= 0.85;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{p.description || p.pattern_key}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {PATTERN_LABEL[p.pattern_type] || p.pattern_type} · {p.evidence_count} evidencias
                        {isAuto && " · auto"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={() => rejectPattern(p.id)}
                      title="Desaprender este patrón"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* Salud de tipos de sugerencia */}
      {health.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Salud de sugerencias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.map((h) => {
              const acceptRate =
                h.total_count > 0 ? Math.round((h.accepted_count / h.total_count) * 100) : 0;
              const cfg = STATUS_CFG[h.status] || STATUS_CFG.healthy;
              return (
                <div key={h.suggestion_type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">{h.suggestion_type}</span>
                    <Badge variant="outline" className={cfg.cls}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <Progress value={acceptRate} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {h.accepted_count}/{h.total_count} aceptadas
                    </span>
                    {h.threshold_adjustment > 0 && (
                      <span className="text-warning">
                        +{Math.round(h.threshold_adjustment * 100)}% umbral
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {patterns.length === 0 && health.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          JARVIS aún no tiene suficientes datos. Sigue usando la app y aprenderá de tus decisiones.
        </p>
      )}
    </div>
  );
};

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 bg-card">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
