import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Battery, Heart, Target, Clock, AlertTriangle, Zap, Loader2, CheckCircle2, Lock } from "lucide-react";

export interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: "low" | "medium" | "high";
  dayMode: "balanced" | "push" | "survival";
}

interface CheckInCardProps {
  data: CheckInData;
  onUpdate: (data: CheckInData) => void;
  onRegister: () => void;
  saving?: boolean;
  isRegistered?: boolean;
}

export const CheckInCard = ({ data, onUpdate, onRegister, saving, isRegistered }: CheckInCardProps) => {
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
            {saving && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          </CardTitle>
          {isRegistered && (
            <div className="flex items-center gap-1.5 text-success text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Registrado
            </div>
          )}
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
              <span className="text-sm font-bold text-primary font-mono">{data.energy}/5</span>
            </div>
            <Slider
              value={[data.energy]}
              onValueChange={([value]) => onUpdate({ ...data, energy: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
              disabled={isRegistered}
            />
          </div>

          {/* Mood */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-foreground">Ánimo</span>
              </div>
              <span className="text-sm font-bold text-primary font-mono">{data.mood}/5</span>
            </div>
            <Slider
              value={[data.mood]}
              onValueChange={([value]) => onUpdate({ ...data, mood: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
              disabled={isRegistered}
            />
          </div>

          {/* Focus */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Foco</span>
              </div>
              <span className="text-sm font-bold text-primary font-mono">{data.focus}/5</span>
            </div>
            <Slider
              value={[data.focus]}
              onValueChange={([value]) => onUpdate({ ...data, focus: value })}
              min={1}
              max={5}
              step={1}
              className="w-full"
              disabled={isRegistered}
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
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={data.availableTime}
                  onChange={(e) => onUpdate({ ...data, availableTime: Number(e.target.value) })}
                  className="w-12 bg-transparent text-lg font-bold text-foreground border-none outline-none font-mono disabled:opacity-60"
                  min={0}
                  max={24}
                  disabled={isRegistered}
                />
                <span className="text-sm text-muted-foreground">h</span>
              </div>
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
                    onClick={() => !isRegistered && onUpdate({ ...data, interruptionRisk: risk })}
                    disabled={isRegistered}
                    className={`px-2 py-1 text-xs rounded-md border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
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
                    onClick={() => !isRegistered && onUpdate({ ...data, dayMode: mode })}
                    disabled={isRegistered}
                    className={`px-2 py-1 text-xs rounded-md border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
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

        {/* Register Button */}
        {!isRegistered ? (
          <Button 
            onClick={onRegister}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Registrar Check-in
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Check-in bloqueado hasta mañana
          </div>
        )}
      </CardContent>
    </Card>
  );
};
