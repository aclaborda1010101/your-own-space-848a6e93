import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Apple, Check, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { useICloudCalendar } from "@/hooks/useICloudCalendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const ICloudCalendarSettingsCard = () => {
  const { connected, checkConnection, lastSync } = useICloudCalendar();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = async () => {
    if (!user || !email || !password) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setSaving(true);
    try {
      const normalizedEmail = email.trim();
      const normalizedPassword = password.trim().replace(/\s+/g, "");

      const { error } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: user.id,
          icloud_email: normalizedEmail,
          icloud_password_encrypted: normalizedPassword, // In production, encrypt this
          icloud_enabled: true,
        }, { onConflict: "user_id" });

      if (error) throw error;

      toast.success("Credenciales de iCloud guardadas");
      setShowForm(false);
      setEmail("");
      setPassword("");
      
      // Re-check connection
      await checkConnection();
    } catch (error) {
      console.error("Error saving iCloud credentials:", error);
      toast.error("Error al guardar las credenciales");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_integrations")
        .update({
          icloud_email: null,
          icloud_password_encrypted: null,
          icloud_enabled: false,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("iCloud Calendar desconectado");
      await checkConnection();
    } catch (error) {
      console.error("Error disconnecting iCloud:", error);
      toast.error("Error al desconectar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="h-5 w-5 text-primary" />
          iCloud Calendar
        </CardTitle>
        <CardDescription>
          Sincroniza tu calendario de Apple para ver y crear eventos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <Check className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Última sincronización: {lastSync.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Tu calendario de iCloud está sincronizado. Los eventos aparecerán en tu agenda.
            </p>
            <Button variant="outline" onClick={handleDisconnect}>
              Desconectar
            </Button>
          </div>
        ) : showForm ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">Contraseña de aplicación requerida</p>
                  <p className="text-muted-foreground mt-1">
                    Debes crear una contraseña específica de aplicación en{" "}
                    <a 
                      href="https://appleid.apple.com/account/manage" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      appleid.apple.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icloud-email">Apple ID (Email)</Label>
              <Input
                id="icloud-email"
                type="email"
                placeholder="tu@icloud.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icloud-password">Contraseña de Aplicación</Label>
              <Input
                id="icloud-password"
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Genera una contraseña de aplicación específica, NO uses tu contraseña de Apple ID
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !email || !password}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecta tu cuenta de iCloud para sincronizar eventos del calendario con JARVIS.
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Ve a <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">appleid.apple.com</a></li>
              <li>Inicia sesión con tu Apple ID</li>
              <li>Ve a "Seguridad" → "Contraseñas de aplicación"</li>
              <li>Genera una nueva contraseña para "JARVIS"</li>
              <li>Copia la contraseña generada</li>
            </ol>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Apple className="w-4 h-4" />
              Configurar iCloud Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
