import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, RefreshCw, Loader2, Unlink } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const GoogleCalendarSettingsCard = () => {
  const { connected, needsReauth, reconnectGoogle, loading } = useGoogleCalendar();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Sign out completely and redirect to login
      await supabase.auth.signOut();
      toast.success("Sesión cerrada. Inicia sesión de nuevo para reconectar.");
    } catch (error) {
      toast.error("Error al desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    }
    if (connected && !needsReauth) {
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    }
    if (needsReauth) {
      return <RefreshCw className="w-5 h-5 text-warning" />;
    }
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (loading) return "Verificando...";
    if (connected && !needsReauth) return "Conectado";
    if (needsReauth) return "Requiere reconexión";
    return "No conectado";
  };

  const getStatusDescription = () => {
    if (connected && !needsReauth) {
      return "Tu cuenta de Google Calendar está sincronizada correctamente.";
    }
    if (needsReauth) {
      return "Tu sesión de Google ha expirado. Reconecta para seguir sincronizando eventos.";
    }
    return "Conecta tu cuenta de Google para sincronizar eventos del calendario.";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Sincroniza tus eventos con Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-foreground">{getStatusText()}</p>
              <p className="text-sm text-muted-foreground">
                {getStatusDescription()}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {(!connected || needsReauth) && (
            <Button onClick={reconnectGoogle} disabled={loading}>
              <Calendar className="h-4 w-4 mr-2" />
              {needsReauth ? "Reconectar" : "Conectar Google Calendar"}
            </Button>
          )}

          {connected && !needsReauth && (
            <>
              <Button variant="outline" onClick={reconnectGoogle} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={disconnecting}>
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desconectar Google Calendar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto cerrará tu sesión actual. Podrás volver a conectar Google Calendar 
                      iniciando sesión de nuevo con tu cuenta de Google.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          JARVIS puede leer y crear eventos en tu calendario para ayudarte a gestionar tu tiempo.
        </p>
      </CardContent>
    </Card>
  );
};
