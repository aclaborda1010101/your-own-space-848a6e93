import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

const SCOPES =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

export default function OAuthGoogle() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/oauth/google/callback`,
          scopes: SCOPES,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
        },
      });
      if (error) throw error;
      // Browser will redirect to Google immediately.
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar el login con Google");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Conectar Google | JARVIS";
    start();
  }, [start]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold text-foreground">Conectando con Google</h1>
          </CardTitle>
          <CardDescription>
            Necesitamos permisos para sincronizar tu Google Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Redirigiendo a Google…</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={start} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Si ves una página en blanco, revisa que el navegador no esté bloqueando redirecciones o
            popups.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
