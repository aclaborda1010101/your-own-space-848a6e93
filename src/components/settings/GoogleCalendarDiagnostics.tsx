import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Key,
  Shield,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DiagnosticData {
  tokenStatus: "valid" | "expired" | "missing" | "checking";
  tokenExpiresAt?: string;
  scopes: string[];
  lastError: string | null;
  lastErrorTime?: string;
  calendarAccess: boolean;
  userEmail?: string;
}

export const GoogleCalendarDiagnostics = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    const result: DiagnosticData = {
      tokenStatus: "checking",
      scopes: [],
      lastError: null,
      calendarAccess: false,
    };

    try {
      // Get session and token info
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      
      // Also check localStorage for iframe flow token
      const localStorageToken = localStorage.getItem("google_provider_token");
      const providerToken = session?.provider_token || localStorageToken;
      
      if (!providerToken) {
        result.tokenStatus = "missing";
        result.lastError = "No se encontró token de Google. El usuario necesita reconectar.";
        result.lastErrorTime = new Date().toISOString();
        setDiagnostics(result);
        return;
      }

      // Try to get token info from Google
      const tokenInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${providerToken}`
      );

      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        result.tokenStatus = "valid";
        result.scopes = tokenInfo.scope ? tokenInfo.scope.split(" ") : [];
        result.userEmail = tokenInfo.email;
        
        // Calculate expiration
        if (tokenInfo.expires_in) {
          const expiresAt = new Date(Date.now() + tokenInfo.expires_in * 1000);
          result.tokenExpiresAt = expiresAt.toISOString();
        }
      } else {
        const errorData = await tokenInfoResponse.json();
        result.tokenStatus = "expired";
        result.lastError = errorData.error_description || "Token inválido o expirado";
        result.lastErrorTime = new Date().toISOString();
      }

      // Test calendar access
      if (result.tokenStatus === "valid") {
        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary`,
          {
            headers: {
              Authorization: `Bearer ${providerToken}`,
            },
          }
        );

        if (calendarResponse.ok) {
          result.calendarAccess = true;
        } else {
          const calendarError = await calendarResponse.json();
          result.calendarAccess = false;
          result.lastError = `Acceso al calendario: ${calendarError.error?.message || calendarResponse.statusText}`;
          result.lastErrorTime = new Date().toISOString();
        }
      }
    } catch (error) {
      result.tokenStatus = "missing";
      result.lastError = error instanceof Error ? error.message : "Error desconocido";
      result.lastErrorTime = new Date().toISOString();
    } finally {
      setLoading(false);
      setDiagnostics(result);
    }
  };

  const getTokenStatusBadge = () => {
    if (!diagnostics) return null;
    
    switch (diagnostics.tokenStatus) {
      case "valid":
        return <Badge variant="default" className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Válido</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Expirado</Badge>;
      case "missing":
        return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> No encontrado</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando</Badge>;
    }
  };

  const formatExpiration = (isoString?: string) => {
    if (!isoString) return "Desconocido";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 0) return "Expirado";
    if (diffMins < 60) return `${diffMins} minutos`;
    return `${Math.round(diffMins / 60)} horas`;
  };

  const requiredScopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ];

  const getScopeStatus = (scope: string) => {
    if (!diagnostics) return "unknown";
    return diagnostics.scopes.some(s => s.includes(scope.split("/").pop() || "")) ? "granted" : "missing";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Panel de Diagnóstico
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3 space-y-4">
        <div className="p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-sm text-foreground">Diagnóstico de Sincronización</h4>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={runDiagnostics} 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Ejecutar</span>
            </Button>
          </div>

          {!diagnostics && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Haz clic en "Ejecutar" para analizar el estado de la conexión.
            </p>
          )}

          {diagnostics && (
            <div className="space-y-4">
              {/* Token Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Key className="h-4 w-4" />
                  Estado del Token
                </div>
                <div className="pl-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    {getTokenStatusBadge()}
                  </div>
                  {diagnostics.userEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cuenta:</span>
                      <span className="text-sm text-foreground">{diagnostics.userEmail}</span>
                    </div>
                  )}
                  {diagnostics.tokenExpiresAt && diagnostics.tokenStatus === "valid" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expira en:
                      </span>
                      <span className="text-sm text-foreground">
                        {formatExpiration(diagnostics.tokenExpiresAt)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Acceso a calendario:</span>
                    {diagnostics.calendarAccess ? (
                      <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Sin acceso
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Scopes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Shield className="h-4 w-4" />
                  Permisos (Scopes)
                </div>
                <div className="pl-6 space-y-1">
                  {requiredScopes.map((scope) => {
                    const status = getScopeStatus(scope);
                    const scopeName = scope.split("/").pop() || scope;
                    return (
                      <div key={scope} className="flex items-center justify-between text-sm">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {scopeName}
                        </code>
                        {status === "granted" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    );
                  })}
                  {diagnostics.scopes.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Ver todos los scopes ({diagnostics.scopes.length})
                      </summary>
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all max-h-32 overflow-y-auto">
                        {diagnostics.scopes.map((s, i) => (
                          <div key={i} className="text-muted-foreground">{s}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Last Error */}
              {diagnostics.lastError && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Último Error
                  </div>
                  <div className="pl-6">
                    <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                      {diagnostics.lastError}
                    </div>
                    {diagnostics.lastErrorTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(diagnostics.lastErrorTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
