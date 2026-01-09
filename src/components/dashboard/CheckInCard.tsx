import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Battery, Heart, Target, Clock, AlertTriangle, Zap, Loader2, CheckCircle2, Lock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { useSoundFeedback } from "@/hooks/useSoundFeedback";

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

const getLevelColor = (value: number) => {
  if (value <= 2) return { bg: "bg-destructive/20", text: "text-destructive", bar: "bg-destructive" };
  if (value <= 3) return { bg: "bg-warning/20", text: "text-warning", bar: "bg-warning" };
  return { bg: "bg-success/20", text: "text-success", bar: "bg-success" };
};

const getLevelLabel = (value: number) => {
  if (value <= 1) return "Muy bajo";
  if (value <= 2) return "Bajo";
  if (value <= 3) return "Normal";
  if (value <= 4) return "Alto";
  return "Muy alto";
};

export const CheckInCard = ({ data, onUpdate, onRegister, saving, isRegistered }: CheckInCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const haptics = useHaptics();
  const sounds = useSoundFeedback();
  
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

  const handleSliderChange = (field: keyof CheckInData) => (value: number[]) => {
    haptics.selection();
    sounds.tap();
    onUpdate({ ...data, [field]: value[0] });
  };

  const handleButtonSelect = <T extends string>(field: keyof CheckInData, value: T) => {
    haptics.lightTap();
    sounds.tap();
    onUpdate({ ...data, [field]: value });
  };

  const handleRegister = () => {
    haptics.success();
    sounds.success();
    onRegister();
  };

  // Registered view - compact visual summary
  if (isRegistered) {
    const energyColor = getLevelColor(data.energy);
    const moodColor = getLevelColor(data.mood);
    const focusColor = getLevelColor(data.focus);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="border border-border bg-card rounded-lg">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <span className="text-sm sm:text-base font-semibold text-foreground">Check-in Completado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Lock className="w-3 h-3" />
                  <span className="hidden sm:inline">Bloqueado</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Visual Indicators */}
              <div className="grid grid-cols-3 gap-3">
                {/* Energy */}
                <div className={cn("rounded-lg p-3 text-center", energyColor.bg)}>
                  <Battery className={cn("w-5 h-5 mx-auto mb-1", energyColor.text)} />
                  <p className={cn("text-2xl font-bold font-mono", energyColor.text)}>{data.energy}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Energía</p>
                  <div className="mt-2 h-1.5 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", energyColor.bar)}
                      style={{ width: `${(data.energy / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Mood */}
                <div className={cn("rounded-lg p-3 text-center", moodColor.bg)}>
                  <Heart className={cn("w-5 h-5 mx-auto mb-1", moodColor.text)} />
                  <p className={cn("text-2xl font-bold font-mono", moodColor.text)}>{data.mood}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ánimo</p>
                  <div className="mt-2 h-1.5 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", moodColor.bar)}
                      style={{ width: `${(data.mood / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Focus */}
                <div className={cn("rounded-lg p-3 text-center", focusColor.bg)}>
                  <Target className={cn("w-5 h-5 mx-auto mb-1", focusColor.text)} />
                  <p className={cn("text-2xl font-bold font-mono", focusColor.text)}>{data.focus}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Foco</p>
                  <div className="mt-2 h-1.5 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", focusColor.bar)}
                      style={{ width: `${(data.focus / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Info Row */}
              <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{data.availableTime}h</span>
                  </div>
                  <div className={cn("px-2 py-0.5 rounded text-xs border", riskColors[data.interruptionRisk])}>
                    Riesgo {riskLabels[data.interruptionRisk].toLowerCase()}
                  </div>
                </div>
                <div className={cn("px-2 py-0.5 rounded text-xs border", modeColors[data.dayMode])}>
                  {modeLabels[data.dayMode]}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  // Editable view
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border bg-card rounded-lg">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-foreground">Check-in Diario</span>
              {saving && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
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
              onValueChange={handleSliderChange("energy")}
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
              <span className="text-sm font-bold text-primary font-mono">{data.mood}/5</span>
            </div>
            <Slider
              value={[data.mood]}
              onValueChange={handleSliderChange("mood")}
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
              <span className="text-sm font-bold text-primary font-mono">{data.focus}/5</span>
            </div>
            <Slider
              value={[data.focus]}
              onValueChange={handleSliderChange("focus")}
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
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={data.availableTime}
                  onChange={(e) => onUpdate({ ...data, availableTime: Number(e.target.value) })}
                  className="w-12 bg-transparent text-lg font-bold text-foreground border-none outline-none font-mono"
                  min={0}
                  max={24}
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

        {/* Register Button */}
        <Button 
          onClick={handleRegister}
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
          </CardContent>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
