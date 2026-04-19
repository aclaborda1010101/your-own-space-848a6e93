import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Loader2, Smartphone, Moon, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNativePushNotifications } from "@/hooks/useNativePushNotifications";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Native notification settings — only fully functional inside the iOS app.
 * On web it shows a hint that this section is for the mobile app.
 */
export function NativeNotificationSettings() {
  const { user } = useAuth();
  const push = useNativePushNotifications();
  const { prefs, loading, saving, update } = useNotificationPreferences();
  const isNative = Capacitor.isNativePlatform();

  const sendTest = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: user.id,
        title: "Push de prueba",
        body: "Si ves esto, las notificaciones están operativas 🎉",
        notification_type: "custom",
        bypass_preferences: true,
      },
    });
    if (error) {
      toast.error("Error enviando push", { description: error.message });
      return;
    }
    if ((data as any)?.sent > 0) {
      toast.success("Push enviado");
    } else {
      toast.warning("Sin dispositivos activos", {
        description: "Habilita las notificaciones en este dispositivo primero.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estado del dispositivo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Estado del dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isNative ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
              <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Esta sección requiere la app nativa</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Las preferencias se guardan, pero los push reales solo llegan al iPhone con la app instalada.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {push.permission === "granted" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Permiso concedido</span>
                  </>
                ) : push.permission === "denied" ? (
                  <>
                    <BellOff className="w-4 h-4 text-destructive" />
                    <span>Permiso denegado — actívalo en Ajustes de iOS</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span>Sin registrar todavía</span>
                  </>
                )}
              </div>
              {push.permission !== "granted" && push.permission !== "denied" && (
                <Button size="sm" onClick={() => push.registerDevice()} disabled={push.registering}>
                  {push.registering ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activar"}
                </Button>
              )}
            </div>
          )}

          {push.token && (
            <div className="text-xs text-muted-foreground">
              <span className="opacity-60">Token APNs:</span>{" "}
              <code className="font-mono">{push.token.slice(0, 16)}…{push.token.slice(-6)}</code>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={sendTest} className="w-full">
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Enviar push de prueba
          </Button>
        </CardContent>
      </Card>

      {/* Toggle global */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Activar notificaciones</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Interruptor maestro de todos los push
              </p>
            </div>
            <Switch
              checked={prefs.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Subgrupos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Categorías</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            title="Tareas"
            description="Recordatorios el día del deadline a las 09:00"
            checked={prefs.tasks_enabled}
            onChange={(v) => update({ tasks_enabled: v })}
            disabled={!prefs.enabled || saving}
          />
          <ToggleRow
            title="Calendario"
            description={`Avisos antes de cada evento (${prefs.calendar_lead_minutes} min)`}
            checked={prefs.calendar_enabled}
            onChange={(v) => update({ calendar_enabled: v })}
            disabled={!prefs.enabled || saving}
          />
          {prefs.calendar_enabled && (
            <div className="ml-1 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Antelación (min):</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={prefs.calendar_lead_minutes}
                onChange={(e) => update({ calendar_lead_minutes: Number(e.target.value) || 15 })}
                className="h-8 w-20"
                disabled={saving}
              />
            </div>
          )}
          <ToggleRow
            title="Sugerencias JARVIS"
            description="Brief de mañana, alertas de burnout, insights"
            checked={prefs.jarvis_enabled}
            onChange={(v) => update({ jarvis_enabled: v })}
            disabled={!prefs.enabled || saving}
          />
          <ToggleRow
            title="Plaud"
            description="Clasificaciones pendientes de revisar"
            checked={prefs.plaud_enabled}
            onChange={(v) => update({ plaud_enabled: v })}
            disabled={!prefs.enabled || saving}
          />
        </CardContent>
      </Card>

      {/* Quiet hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Moon className="w-4 h-4" />
            Horario de silencio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Activar silencio nocturno</Label>
            <Switch
              checked={prefs.quiet_hours_enabled}
              onCheckedChange={(v) => update({ quiet_hours_enabled: v })}
              disabled={saving}
            />
          </div>
          {prefs.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="time"
                  value={prefs.quiet_hours_start}
                  onChange={(e) => update({ quiet_hours_start: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="time"
                  value={prefs.quiet_hours_end}
                  onChange={(e) => update({ quiet_hours_end: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>
          )}
          <Badge variant="outline" className="text-xs">
            Zona: {prefs.timezone}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{title}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export default NativeNotificationSettings;
