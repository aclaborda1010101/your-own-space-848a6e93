import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings, Timer, Coffee, Armchair } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { toast } from "sonner";

export const PomodoroSettingsDialog = () => {
  const { settings, updateSettings } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [workDuration, setWorkDuration] = useState(settings.pomodoro_work_duration);
  const [shortBreak, setShortBreak] = useState(settings.pomodoro_short_break);
  const [longBreak, setLongBreak] = useState(settings.pomodoro_long_break);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setWorkDuration(settings.pomodoro_work_duration);
      setShortBreak(settings.pomodoro_short_break);
      setLongBreak(settings.pomodoro_long_break);
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        pomodoro_work_duration: workDuration,
        pomodoro_short_break: shortBreak,
        pomodoro_long_break: longBreak,
      });
      toast.success("Ajustes guardados");
      setOpen(false);
    } catch (error) {
      toast.error("Error al guardar los ajustes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Ajustes de Pomodoro
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Work Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Sesión de trabajo
              </Label>
              <span className="text-sm font-medium">{workDuration} min</span>
            </div>
            <Slider
              value={[workDuration]}
              onValueChange={(v) => setWorkDuration(v[0])}
              min={5}
              max={60}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Short Break */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Coffee className="h-4 w-4 text-success" />
                Descanso corto
              </Label>
              <span className="text-sm font-medium">{shortBreak} min</span>
            </div>
            <Slider
              value={[shortBreak]}
              onValueChange={(v) => setShortBreak(v[0])}
              min={1}
              max={15}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 min</span>
              <span>15 min</span>
            </div>
          </div>

          {/* Long Break */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-warning" />
                Descanso largo
              </Label>
              <span className="text-sm font-medium">{longBreak} min</span>
            </div>
            <Slider
              value={[longBreak]}
              onValueChange={(v) => setLongBreak(v[0])}
              min={5}
              max={30}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5 min</span>
              <span>30 min</span>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Guardando..." : "Guardar ajustes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};