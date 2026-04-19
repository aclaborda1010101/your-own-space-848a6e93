import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { consumeRedirectTarget, getSafeRedirectTarget } from "@/lib/oauth";

export default function OAuthGoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Finalizando Google | JARVIS";

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const queryTarget = getSafeRedirectTarget(searchParams.get("redirectTo"), "");
    const target = queryTarget || consumeRedirectTarget("/dashboard");

    const run = async () => {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[OAuth Callback] getSession error:", error.message);
        }

        const session = data?.session;
        if (session?.access_token) {
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(
                {
                  type: "oauth:google",
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                  provider_token: session.provider_token,
                  provider_refresh_token: session.provider_refresh_token,
                  redirectTo: target,
                },
                window.location.origin
              );
              setStatus("done");
              setTimeout(() => window.close(), 250);
              return;
            }
          } catch {
            // cross-origin opener
          }

          setStatus("done");
          navigate(target, { replace: true });
          return;
        }

        await sleep(150);
      }

      setError("No se pudo recuperar la sesión tras el login con Google.");
      setStatus("error");
    };

    run();
  }, [navigate, searchParams]);

  const retry = () => {
    window.location.assign(`${window.location.origin}/oauth/google`);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold text-foreground">Finalizando conexión</h1>
          </CardTitle>
          <CardDescription>
            Estamos completando el inicio de sesión con Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Procesando…</p>
            </div>
          )}

          {status === "done" && (
            <p className="text-sm text-muted-foreground">
              Listo. Ya puedes volver a la pestaña anterior.
            </p>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={retry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Si esto se queda cargando, revisa que el navegador no esté bloqueando redirecciones o popups.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
