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
    try { await supabase.auth.signOut(); }
    catch (error) { console.warn("[JARVIS Auth] SignOut error:", error); }
    setUser(null);
    setSession(null);
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
