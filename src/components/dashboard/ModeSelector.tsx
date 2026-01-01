import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Sun, 
  Palmtree, 
  AlertTriangle,
  ChevronDown,
  Clock
} from "lucide-react";

const MODES = {
  normal: {
    label: "Normal",
    icon: Sun,
    color: "bg-success/20 text-success border-success/30",
    description: "Planificación completa, todas las funciones activas"
  },
  vacation: {
    label: "Vacaciones",
    icon: Palmtree,
    color: "bg-warning/20 text-warning border-warning/30",
    description: "Planificación relajada, notificaciones reducidas, solo bienestar"
  },
  crisis: {
    label: "Crisis",
    icon: AlertTriangle,
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Solo 1 prioridad, bloques cortos, nutrición básica, Coach en contención"
  }
} as const;

interface ModeSelectorProps {
  compact?: boolean;
}

export function ModeSelector({ compact = false }: ModeSelectorProps) {
  const { profile, updateProfile } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<string | null>(null);

  const currentMode = (profile?.current_mode as keyof typeof MODES) || "normal";
  const modeConfig = MODES[currentMode];
  const ModeIcon = modeConfig.icon;

  const handleModeChange = async (newMode: string) => {
    if (newMode === currentMode) {
      setOpen(false);
      return;
    }

    // If switching to normal from crisis, need 48h transition
    if (currentMode === "crisis" && newMode === "normal") {
      toast.info("Transición de 48h iniciada. El sistema se normalizará gradualmente.");
    }

    const success = await updateProfile({
      current_mode: newMode,
      mode_activated_at: new Date().toISOString()
    });

    if (success) {
      toast.success(`Modo ${MODES[newMode as keyof typeof MODES].label} activado`);
      setOpen(false);
      setConfirmMode(null);
    }
  };

  if (compact) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("gap-2", modeConfig.color)}
          >
            <ModeIcon className="w-4 h-4" />
            {modeConfig.label}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DialogTrigger>
        <ModeDialogContent 
          currentMode={currentMode}
          confirmMode={confirmMode}
          setConfirmMode={setConfirmMode}
          onModeChange={handleModeChange}
          onClose={() => setOpen(false)}
        />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className={cn(
          "p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
          modeConfig.color
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", modeConfig.color)}>
                <ModeIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">Modo {modeConfig.label}</p>
                <p className="text-xs opacity-70">{modeConfig.description}</p>
              </div>
            </div>
            <ChevronDown className="w-5 h-5" />
          </div>
          {profile?.mode_activated_at && currentMode !== "normal" && (
            <div className="mt-3 pt-3 border-t border-current/20 flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3" />
              Activado: {new Date(profile.mode_activated_at).toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      </DialogTrigger>
      <ModeDialogContent 
        currentMode={currentMode}
        confirmMode={confirmMode}
        setConfirmMode={setConfirmMode}
        onModeChange={handleModeChange}
        onClose={() => setOpen(false)}
      />
    </Dialog>
  );
}

function ModeDialogContent({ 
  currentMode, 
  confirmMode, 
  setConfirmMode, 
  onModeChange,
  onClose
}: {
  currentMode: string;
  confirmMode: string | null;
  setConfirmMode: (mode: string | null) => void;
  onModeChange: (mode: string) => void;
  onClose: () => void;
}) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Cambiar modo del sistema</DialogTitle>
        <DialogDescription>
          El modo afecta cómo JARVIS planifica y te asiste.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-4">
        {Object.entries(MODES).map(([mode, config]) => {
          const Icon = config.icon;
          const isActive = mode === currentMode;
          const isConfirming = mode === confirmMode;

          return (
            <div key={mode} className="space-y-2">
              <button
                onClick={() => {
                  if (mode === currentMode) return;
                  if (mode === "crisis" || mode === "vacation") {
                    setConfirmMode(mode);
                  } else {
                    onModeChange(mode);
                  }
                }}
                className={cn(
                  "w-full p-4 rounded-lg border text-left transition-all",
                  isActive 
                    ? cn(config.color, "ring-2 ring-offset-2 ring-offset-background ring-current")
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    isActive ? config.color : "bg-muted"
                  )}>
                    <Icon className={cn("w-5 h-5", isActive ? "" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{config.label}</p>
                      {isActive && <Badge variant="secondary" className="text-xs">Activo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
              </button>

              {isConfirming && (
                <div className="ml-4 p-3 rounded-lg bg-muted/50 border border-border space-y-3">
                  <p className="text-sm">
                    {mode === "crisis" 
                      ? "⚠️ El modo Crisis cancelará tareas no esenciales y reducirá la actividad del sistema. ¿Confirmar?"
                      : "🌴 El modo Vacaciones desactivará la planificación estricta. ¿Confirmar?"}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmMode(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => onModeChange(mode)}>
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {currentMode === "crisis" && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
          <p className="font-medium mb-1">Volver a modo Normal</p>
          <p className="text-muted-foreground text-xs">
            Al salir del modo Crisis, el sistema hará una transición gradual de 48h para 
            retomar la planificación completa sin sobrecargarte.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
