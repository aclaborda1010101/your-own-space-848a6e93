import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Receives OAuth session tokens from the top-level popup/tab (postMessage)
 * and stores them in this window's auth storage (needed for iframe previews).
 */
export default function OAuthMessageBridge() {
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as any;
      if (!data || data.type !== "oauth:google") return;

      const access_token = data.access_token as string | undefined;
      const refresh_token = data.refresh_token as string | undefined;
      const provider_token = data.provider_token as string | undefined;
      const provider_refresh_token = data.provider_refresh_token as string | undefined;
      if (!access_token || !refresh_token) return;

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        toast.error(error.message || "No se pudo completar el login con Google");
        return;
      }

      if (provider_token) {
        localStorage.setItem("google_provider_token", provider_token);
      } else {
        // Best-effort: if available after setSession, persist it.
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.provider_token;
        if (token) localStorage.setItem("google_provider_token", token);
      }

      // Store provider refresh token for auto-refresh capability
      if (provider_refresh_token) {
        localStorage.setItem("google_provider_refresh_token", provider_refresh_token);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const refreshToken = sessionData.session?.provider_refresh_token;
        if (refreshToken) localStorage.setItem("google_provider_refresh_token", refreshToken);
      }

      toast.success("Conectado con Google");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
