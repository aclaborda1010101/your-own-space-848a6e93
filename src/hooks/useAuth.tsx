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
    localStorage.removeItem("google_provider_token");
    localStorage.removeItem("google_provider_refresh_token");
    localStorage.removeItem("google_token_expires_at");
  } catch { /* ignore */ }

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

/** Best-effort, non-blocking persistence of Google provider tokens. */
function persistGoogleProviderTokenAsync(currentSession: Session) {
  if (!currentSession?.provider_token || !currentSession.user?.id) return;
  // Fire-and-forget; never blocks auth reconciliation.
  Promise.resolve().then(async () => {
    try {
      await supabase.from("user_integrations").upsert({
        user_id: currentSession.user.id,
        provider: "google",
        access_token: currentSession.provider_token!,
        refresh_token: currentSession.provider_refresh_token || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });
    } catch (e) {
      console.warn("[JARVIS Auth] Could not save provider token:", e);
    }
  });
}

/** getSession with one short retry on transient failure. NEVER signs out. */
async function getSessionWithRetry(): Promise<{ session: Session | null; hadError: boolean }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) return { session: data.session ?? null, hadError: false };
    console.warn("[JARVIS Auth] getSession error, retrying:", error.message);
  } catch (e) {
    console.warn("[JARVIS Auth] getSession threw, retrying:", e);
  }

  await new Promise((r) => setTimeout(r, 800));

  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) return { session: data.session ?? null, hadError: false };
    console.warn("[JARVIS Auth] getSession failed after retry:", error.message);
    return { session: null, hadError: true };
  } catch (e) {
    console.warn("[JARVIS Auth] getSession threw after retry:", e);
    return { session: null, hadError: true };
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1) Subscribe FIRST so we don't miss INITIAL_SESSION / TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        console.log("[JARVIS Auth] Event:", event, "hasSession:", !!currentSession);

        switch (event) {
          case "INITIAL_SESSION":
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
          case "USER_UPDATED": {
            setSession(currentSession ?? null);
            setUser(currentSession?.user ?? null);
            if (currentSession) persistGoogleProviderTokenAsync(currentSession);
            setLoading(false);
            break;
          }
          case "SIGNED_OUT": {
            setSession(null);
            setUser(null);
            setLoading(false);
            break;
          }
          default: {
            // Be conservative on unknown events: reflect Supabase's truth but never wipe on null.
            if (currentSession) {
              setSession(currentSession);
              setUser(currentSession.user);
            }
            setLoading(false);
          }
        }
      }
    );

    // 2) Then hydrate
    (async () => {
      const { session: hydrated, hadError } = await getSessionWithRetry();
      if (!mounted) return;

      if (hydrated) {
        setSession(hydrated);
        setUser(hydrated.user);
      } else if (hadError) {
        // Transient error: do NOT sign out. Leave whatever the listener provides.
        console.warn("[JARVIS Auth] Hydration failed transiently — keeping current state");
      } else {
        // Truly no session
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    })();

    // 3) Re-hydrate when network comes back
    const onOnline = () => {
      console.log("[JARVIS Auth] online — refreshing session");
      supabase.auth.getSession().catch(() => { /* ignore */ });
    };
    window.addEventListener("online", onOnline);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const signOut = async () => {
    console.log("[JARVIS Auth] signOut() invoked");

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch (error) {
      console.warn("[JARVIS Auth] supabase.signOut error (ignored):", error);
    }

    setUser(null);
    setSession(null);
    purgeLocalAuthArtifacts();

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
