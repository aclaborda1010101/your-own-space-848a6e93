import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Timer, 
  Bell, 
  BellOff, 
  Coffee, 
  Armchair, 
  User,
  Save,
  Loader2
} from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { ThemeSettingsCard } from "@/components/settings/ThemeSettingsCard";
import { AccessibilitySettingsCard } from "@/components/settings/AccessibilitySettingsCard";

const Settings = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { settings, loading, updateSettings } = useUserSettings();
  
  const [workDuration, setWorkDuration] = useState(settings.pomodoro_work_duration);
  const [shortBreak, setShortBreak] = useState(settings.pomodoro_short_break);
  const [longBreak, setLongBreak] = useState(settings.pomodoro_long_break);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [saving, setSaving] = useState(false);

  // Sync local state with settings
  useEffect(() => {
    setWorkDuration(settings.pomodoro_work_duration);
    setShortBreak(settings.pomodoro_short_break);
    setLongBreak(settings.pomodoro_long_break);
  }, [settings]);

  // Check notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toast.success("Notificaciones habilitadas");
        new Notification("¡Notificaciones activadas!", {
          body: "Recibirás alertas cuando terminen tus sesiones de Pomodoro",
          icon: "/favicon.ico",
        });
      } else if (permission === "denied") {
        toast.error("Notificaciones bloqueadas. Habilítalas desde la configuración del navegador.");
      }
    } else {
      toast.error("Tu navegador no soporta notificaciones");
    }
  };

  const handleSavePomodoro = async () => {
    setSaving(true);
    try {
      await updateSettings({
        pomodoro_work_duration: workDuration,
        pomodoro_short_break: shortBreak,
        pomodoro_long_break: longBreak,
      });
      toast.success("Ajustes de Pomodoro guardados");
    } catch (error) {
      toast.error("Error al guardar los ajustes");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    workDuration !== settings.pomodoro_work_duration ||
    shortBreak !== settings.pomodoro_short_break ||
    longBreak !== settings.pomodoro_long_break;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando ajustes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6 max-w-4xl">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
            <p className="text-muted-foreground text-sm">
              Personaliza tu experiencia en JARVIS
            </p>
          </div>

          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Perfil
              </CardTitle>
              <CardDescription>
                Información de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {user?.email?.split("@")[0] || "Usuario"}
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <ThemeSettingsCard />

          {/* Accessibility Settings */}
          <AccessibilitySettingsCard />

          {/* Notifications Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {notificationPermission === "granted" ? (
                  <Bell className="h-5 w-5 text-success" />
                ) : (
                  <BellOff className="h-5 w-5 text-warning" />
                )}
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configura las alertas del navegador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Notificaciones del navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Recibe alertas cuando terminen tus sesiones de Pomodoro
                  </p>
                </div>
                {notificationPermission === "granted" ? (
                  <div className="flex items-center gap-2 text-success">
                    <Bell className="h-4 w-4" />
                    <span className="text-sm font-medium">Habilitadas</span>
                  </div>
                ) : notificationPermission === "denied" ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <BellOff className="h-4 w-4" />
                    <span className="text-sm font-medium">Bloqueadas</span>
                  </div>
                ) : (
                  <Button onClick={handleRequestNotifications} variant="outline" size="sm">
                    <Bell className="h-4 w-4 mr-2" />
                    Habilitar
                  </Button>
                )}
              </div>
              
              {notificationPermission === "denied" && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Las notificaciones están bloqueadas. Para habilitarlas, haz clic en el icono 
                  del candado en la barra de direcciones de tu navegador y permite las notificaciones.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pomodoro Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                Temporizador Pomodoro
              </CardTitle>
              <CardDescription>
                Personaliza la duración de tus sesiones de trabajo y descanso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Work Duration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-primary" />
                    Sesión de trabajo
                  </Label>
                  <span className="text-sm font-medium tabular-nums">{workDuration} min</span>
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

              <Separator />

              {/* Short Break */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-success" />
                    Descanso corto
                  </Label>
                  <span className="text-sm font-medium tabular-nums">{shortBreak} min</span>
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

              <Separator />

              {/* Long Break */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Armchair className="h-4 w-4 text-warning" />
                    Descanso largo
                  </Label>
                  <span className="text-sm font-medium tabular-nums">{longBreak} min</span>
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
                <Button 
                  onClick={handleSavePomodoro} 
                  disabled={saving || !hasChanges}
                  className="w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Export */}
          <DataExportCard />
        </main>
      </div>
    </div>
  );
};

export default Settings;