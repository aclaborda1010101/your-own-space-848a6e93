import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const NATIVE_REDIRECT_URL = "jarvisapp://auth/callback";

export const GOOGLE_SCOPES =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Inicia el flujo OAuth con Google en plataforma nativa (iOS/Android via Capacitor).
 * Devuelve true si manejó el flujo nativamente; false si debe usarse el flujo web.
 */
export async function signInWithGoogleNative(): Promise<boolean> {
  if (!isNative()) return false;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_REDIRECT_URL,
      skipBrowserRedirect: true,
      scopes: GOOGLE_SCOPES,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
  });

  if (error || !data?.url) {
    toast.error(error?.message || "No se pudo iniciar Google en la app");
    return true; // Manejado (con error), no caer al flujo web
  }

  await Browser.open({ url: data.url, presentationStyle: "popover" });
  return true;
}

let deepLinkRegistered = false;

/**
 * Registra el listener de deep link para completar OAuth en la app nativa.
 * Debe llamarse una sola vez al arrancar la app.
 */
export function registerNativeAuthDeepLink() {
  if (!isNative() || deepLinkRegistered) return;
  deepLinkRegistered = true;

  App.addListener("appUrlOpen", async (event: URLOpenListenerEvent) => {
    try {
      const url = event.url;
      if (!url || !url.startsWith("jarvisapp://")) return;

      // Soporta tanto ?code=... (PKCE) como #access_token=...&refresh_token=...
      const parsed = new URL(url);
      const hash = parsed.hash?.startsWith("#") ? parsed.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const queryParams = parsed.searchParams;

      const code = queryParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const providerToken = hashParams.get("provider_token");
      const providerRefreshToken = hashParams.get("provider_refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message || "Fallo al canjear el código de Google");
        } else {
          toast.success("Conectado con Google");
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          toast.error(error.message || "No se pudo establecer la sesión");
        } else {
          try {
            if (providerToken) {
              localStorage.setItem("google_provider_token", providerToken);
              localStorage.setItem(
                "google_token_expires_at",
                String(Date.now() + 3600 * 1000),
              );
            }
            if (providerRefreshToken) {
              localStorage.setItem("google_provider_refresh_token", providerRefreshToken);
            }
          } catch {
            // ignore storage errors
          }
          toast.success("Conectado con Google");
        }
      }
    } catch (err) {
      console.error("[JARVIS Native Auth] deep link error", err);
    } finally {
      try {
        await Browser.close();
      } catch {
        // ignore — el browser puede no estar abierto
      }
    }
  });
}
