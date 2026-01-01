import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useHaptics } from "@/hooks/useHaptics";
import { 
  Bell, 
  BellOff, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Loader2,
  Smartphone,
} from "lucide-react";

interface NotificationPreferences {
  taskReminders: boolean;
  dailyCheckIn: boolean;
  pomodoroAlerts: boolean;
  calendarReminders: boolean;
  checkInTime: string;
}

const PREFS_KEY = "jarvis_notification_prefs";

export const NotificationSettings = () => {
  const { 
    isSupported, 
    permission, 
    requestPermission,
    notifyCheckIn,
  } = usePushNotifications();
  
  const haptics = useHaptics();
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    taskReminders: true,
    dailyCheckIn: true,
    pomodoroAlerts: true,
    calendarReminders: true,
    checkInTime: "08:00",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        setPrefs(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const savePrefs = (newPrefs: NotificationPreferences) => {
    setPrefs(newPrefs);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    } catch {
      // Ignore
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    haptics.lightTap();
    await requestPermission();
    setLoading(false);
  };

  const handleTestNotification = async () => {
    haptics.success();
    await notifyCheckIn();
  };

  const togglePref = (key: keyof NotificationPreferences) => {
    haptics.selection();
    savePrefs({ ...prefs, [key]: !prefs[key] });
  };

  if (!isSupported) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BellOff className="w-5 h-5 text-muted-foreground" />
            Notificaciones no soportadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tu navegador no soporta notificaciones push. Prueba con Chrome o Safari.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notificaciones Push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              permission === "granted" ? "bg-success/20" : "bg-warning/20"
            }`}>
              {permission === "granted" ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <Smartphone className="w-5 h-5 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">
                {permission === "granted" ? "Notificaciones activadas" : "Notificaciones desactivadas"}
              </p>
              <p className="text-sm text-muted-foreground">
                {permission === "granted" 
                  ? "Recibirás alertas importantes" 
                  : "Activa para recibir recordatorios"
                }
              </p>
            </div>
          </div>
          {permission !== "granted" && (
            <Button onClick={handleEnableNotifications} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activar"}
            </Button>
          )}
        </div>

        {/* Notification Types */}
        {permission === "granted" && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Tipos de notificaciones</h4>
            
            <div className="space-y-3">
              {/* Task Reminders */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Recordatorios de tareas</p>
                    <p className="text-xs text-muted-foreground">Alertas para tareas P0 pendientes</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.taskReminders}
                  onCheckedChange={() => togglePref("taskReminders")}
                />
              </div>

              {/* Daily Check-in */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Check-in diario</p>
                    <p className="text-xs text-muted-foreground">Recordatorio matutino</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.dailyCheckIn}
                  onCheckedChange={() => togglePref("dailyCheckIn")}
                />
              </div>

              {/* Pomodoro */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Alertas Pomodoro</p>
                    <p className="text-xs text-muted-foreground">Fin de trabajo/descanso</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.pomodoroAlerts}
                  onCheckedChange={() => togglePref("pomodoroAlerts")}
                />
              </div>

              {/* Calendar */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Eventos del calendario</p>
                    <p className="text-xs text-muted-foreground">15 min antes de cada evento</p>
                  </div>
                </div>
                <Switch 
                  checked={prefs.calendarReminders}
                  onCheckedChange={() => togglePref("calendarReminders")}
                />
              </div>
            </div>

            {/* Test Button */}
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={handleTestNotification}
            >
              <Bell className="w-4 h-4 mr-2" />
              Probar notificación
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
