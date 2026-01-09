import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, RefreshCw, Loader2, Unlink, Zap } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/integrations/supabase/client";
import { GoogleCalendarDiagnostics } from "./GoogleCalendarDiagnostics";
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
  const { connected, needsReauth, reconnectGoogle, disconnectGoogleCalendar, loading } = useGoogleCalendar();
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check token status for diagnostics
  const getTokenStatus = () => {
    try {
      const hasAccessToken = !!localStorage.getItem("google_provider_token");
      const hasRefreshToken = !!localStorage.getItem("google_provider_refresh_token");
      const expiresAt = localStorage.getItem("google_token_expires_at");
      const expiresDate = expiresAt ? new Date(parseInt(expiresAt, 10)) : null;
      const isExpired = expiresDate ? expiresDate < new Date() : true;
      
      return { hasAccessToken, hasRefreshToken, expiresDate, isExpired };
    } catch {
      return { hasAccessToken: false, hasRefreshToken: false, expiresDate: null, isExpired: true };
    }
  };

  const tokenStatus = getTokenStatus();

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const providerToken = session?.session?.provider_token;
      
      if (!providerToken) {
        setTestResult({ 
          success: false, 
          message: "No hay token de Google. Necesitas reconectar tu cuenta." 
        });
        return;
      }

      // Try to fetch events from Google Calendar API directly
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTestResult({ 
          success: true, 
          message: `Conexión exitosa. ${data.items?.length || 0} evento(s) encontrado(s).` 
        });
        toast.success("Conexión con Google Calendar verificada");
      } else {
        const errorData = await response.json();
        setTestResult({ 
          success: false, 
          message: `Error ${response.status}: ${errorData.error?.message || response.statusText}` 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}` 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
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

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${
            testResult.success 
              ? "bg-success/10 text-success border border-success/20" 
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}>
            <p className="font-medium">{testResult.success ? "✓ Éxito" : "✗ Error"}</p>
            <p className="mt-1 break-all">{testResult.message}</p>
          </div>
        )}

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
              <Button 
                variant="secondary" 
                onClick={handleTestConnection} 
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Probar conexión
              </Button>

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

        {/* Token Status */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs space-y-1">
          <p className="font-medium text-muted-foreground">Estado de tokens:</p>
          <p>Access Token: {tokenStatus.hasAccessToken ? "✓" : "✗"}</p>
          <p>Refresh Token: {tokenStatus.hasRefreshToken ? "✓" : "✗"}</p>
          <p>Expira: {tokenStatus.expiresDate 
            ? `${tokenStatus.expiresDate.toLocaleString()} ${tokenStatus.isExpired ? "(expirado)" : ""}` 
            : "N/A"}</p>
          {!tokenStatus.hasRefreshToken && connected && (
            <p className="text-warning mt-2">⚠️ Sin refresh token. Reconecta para obtener tokens con todos los permisos.</p>
          )}
        </div>

        {/* Quick disconnect (only Google tokens, not full logout) */}
        {(connected || tokenStatus.hasAccessToken || tokenStatus.hasRefreshToken) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={disconnectGoogleCalendar}
            className="text-muted-foreground"
          >
            <Unlink className="h-3 w-3 mr-1" />
            Limpiar tokens de Google (sin cerrar sesión)
          </Button>
        )}

        {/* Diagnostics Panel */}
        <GoogleCalendarDiagnostics />

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          JARVIS puede leer y crear eventos en tu calendario para ayudarte a gestionar tu tiempo.
        </p>
      </CardContent>
    </Card>
  );
};
