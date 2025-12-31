import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Battery, Heart, Target, Clock, AlertTriangle, Zap } from "lucide-react";
import type { CheckInData } from "@/pages/Dashboard";

interface CheckInCardProps {
  data: CheckInData;
  onUpdate: (data: CheckInData) => void;
}

export const CheckInCard = ({ data, onUpdate }: CheckInCardProps) => {
  const riskColors = {
    low: "bg-success/20 text-success border-success/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    high: "bg-destructive/20 text-destructive border-destructive/30",
  };

  const modeColors = {
    balanced: "bg-primary/20 text-primary border-primary/30",
    push: "bg-success/20 text-success border-success/30",
    survival: "bg-warning/20 text-warning border-warning/30",
  };

  const modeLabels = {
    balanced: "Balanceado",
    push: "Empuje",
    survival: "Supervivencia",
  };

  const riskLabels = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            Check-in Diario
          </CardTitle>
          <span className="text-xs text-muted-foreground">30 segundos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Energy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-foreground">Energía</span>
              </div>
              <span className="text-sm font-bold text-primary">{data.energy}/5</span>
            </div>
            <Slider
              value={[data.energy]}
              onValueChange={([value]) => onUpdate({ ...data, energy: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Mood */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-foreground">Ánimo</span>
              </div>
              <span className="text-sm font-bold text-primary">{data.mood}/5</span>
            </div>
            <Slider
              value={[data.mood]}
              onValueChange={([value]) => onUpdate({ ...data, mood: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Focus */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Foco</span>
              </div>
              <span className="text-sm font-bold text-primary">{data.focus}/5</span>
            </div>
            <Slider
              value={[data.focus]}
              onValueChange={([value]) => onUpdate({ ...data, focus: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          {/* Available Time */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tiempo disponible</p>
              <input
                type="number"
                value={data.availableTime}
                onChange={(e) => onUpdate({ ...data, availableTime: Number(e.target.value) })}
                className="w-16 bg-transparent text-lg font-bold text-foreground border-none outline-none"
                min={0}
                max={24}
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
          </div>

          {/* Interruption Risk */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Riesgo interrupción</p>
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((risk) => (
                  <button
                    key={risk}
                    onClick={() => onUpdate({ ...data, interruptionRisk: risk })}
                    className={`px-2 py-1 text-xs rounded-md border transition-all ${
                      data.interruptionRisk === risk
                        ? riskColors[risk]
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {riskLabels[risk]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Day Mode */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Zap className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Modo del día</p>
              <div className="flex gap-1">
                {(["balanced", "push", "survival"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onUpdate({ ...data, dayMode: mode })}
                    className={`px-2 py-1 text-xs rounded-md border transition-all ${
                      data.dayMode === mode
                        ? modeColors[mode]
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {modeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
