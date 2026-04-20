import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Best-effort cleanup of all auth-adjacent local state. Never throws. */
function purgeLocalAuthArtifacts() {
  try {
    // Google provider tokens (cached for Calendar API)
    localStorage.removeItem("google_provider_token");
    localStorage.removeItem("google_provider_refresh_token");
    localStorage.removeItem("google_token_expires_at");
  } catch { /* ignore */ }

  // Wipe any sb-* auth tokens that supabase-js may have left behind
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("sb-") && k.includes("-auth-token")) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith("sb-") && k.includes("-auth-token")) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[JARVIS Auth] Session recovery failed, clearing stale tokens:", error.message);
          await supabase.auth.signOut();
          if (mounted) { setUser(null); setSession(null); }
        } else if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.error("[JARVIS Auth] Init error:", err);
        if (mounted) { setUser(null); setSession(null); }
      } finally {
        if (mounted) { setLoading(false); }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        console.log("[JARVIS Auth] Event:", event);

        switch (event) {
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession?.provider_token) {
              try {
                await supabase.from("user_integrations").upsert({
                  user_id: currentSession.user.id,
                  provider: "google",
                  access_token: currentSession.provider_token,
                  refresh_token: currentSession.provider_refresh_token || null,
                  updated_at: new Date().toISOString()
                }, { onConflict: "user_id,provider" });
              } catch (e) {
                console.warn("[JARVIS Auth] Could not save provider token:", e);
              }
            }
            break;
          case "SIGNED_OUT":
            setSession(null);
            setUser(null);
            break;
          default:
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log("[JARVIS Auth] signOut() invoked");

    // 1) Best-effort: tell Supabase to invalidate the refresh token (global = all sessions).
    //    Wrap in a 4s timeout so a hanging network call never blocks logout on iOS.
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch (error) {
      console.warn("[JARVIS Auth] supabase.signOut error (ignored):", error);
    }

    // 2) Hard-clear local state so the UI cannot stay stuck on the authenticated tree.
    setUser(null);
    setSession(null);

    // 3) Purge any cached tokens (sb-*-auth-token, google_provider_*).
    purgeLocalAuthArtifacts();

    // 4) Hard redirect — guarantees React Query caches and any in-flight requests
    //    are dropped, even if a route guard somehow fails to react.
    try {
      window.location.replace("/login");
    } catch {
      try { window.location.href = "/login"; } catch { /* ignore */ }
    }
  };

  const value = { user, session, loading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
