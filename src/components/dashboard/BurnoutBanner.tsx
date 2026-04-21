import { useMemo } from "react";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/useTasks";
import type { JarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import type { WhoopDayData } from "@/hooks/useWhoopHistory";

interface BurnoutBannerProps {
  tasks: Task[];
  whoopData: JarvisWhoopData | null;
  whoopHistory: WhoopDayData[];
}

/**
 * Banner proactivo que detecta DOS patrones de riesgo:
 * 1. Burnout agudo: tareas P0/P1 > 15 + recovery < 40%
 * 2. Patrón crónico: recovery < 50% durante ≥3 días seguidos
 *
 * Se renderiza inline (devuelve null si no hay alerta).
 */
export function BurnoutBanner({ tasks, whoopData: whoop, whoopHistory: history }: BurnoutBannerProps) {

  const criticalTaskCount = useMemo(
    () => tasks.filter(t => !t.completed && (t.priority === "P0" || t.priority === "P1")).length,
    [tasks],
  );

  const recovery = whoop?.recovery_score ?? null;

  const lowRecoveryStreak = useMemo(() => {
    if (!history?.length) return 0;
    // history viene ordenada ascendente (vieja → reciente). Recorremos al revés.
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const r = history[i].recovery_score;
      if (r != null && r < 50) streak++;
      else if (r != null) break;
    }
    return streak;
  }, [history]);

  const burnoutRisk = criticalTaskCount > 15 && recovery != null && recovery < 40;
  const chronicLow = lowRecoveryStreak >= 3;

  if (!burnoutRisk && !chronicLow) return null;

  return (
    <div className="space-y-2">
      {burnoutRisk && (
        <div
          className={cn(
            "rounded-2xl border border-destructive/40 bg-destructive/10 backdrop-blur-xl",
            "p-4 flex items-start gap-3 shadow-[0_0_24px_-8px_hsl(var(--destructive)/0.4)]",
          )}
        >
          <div className="shrink-0 w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">
              Semana de alto riesgo. Reorganiza prioridades hoy.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {criticalTaskCount} tareas P0/P1 abiertas · recuperación al {recovery}%. Tu cuerpo no
              está para empujar más carga. Cancela, delega o aplaza.
            </p>
          </div>
        </div>
      )}

      {chronicLow && (
        <div
          className={cn(
            "rounded-2xl border border-warning/40 bg-warning/10 backdrop-blur-xl",
            "p-4 flex items-start gap-3 shadow-[0_0_24px_-8px_hsl(var(--warning)/0.4)]",
          )}
        >
          <div className="shrink-0 w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warning">
              Llevas {lowRecoveryStreak} días con recuperación baja.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Considera reducir carga esta semana: menos HIIT, más sueño, comida con proteína y
              carbohidrato complejo. La tendencia importa más que un solo día.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
