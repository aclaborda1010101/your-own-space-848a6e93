import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface SessionGuardProps {
  children: React.ReactNode;
}

/**
 * Wrap protected pages. If Supabase loses the session transiently (network blip,
 * token refresh failure), we attempt silent recovery via refreshSession() before
 * redirecting to /login. Prevents "blank page on tab refocus" UX.
 */
export const SessionGuard = ({ children }: SessionGuardProps) => {
  const { user, loading, session } = useAuth();
  const location = useLocation();
  const [recovering, setRecovering] = useState(false);
  const [giveUp, setGiveUp] = useState(false);
  const lastUserRef = useRef(user);

  // Track last known authenticated user so we know if this is a "lost" session vs "never had one"
  useEffect(() => {
    if (user) {
      lastUserRef.current = user;
      setGiveUp(false);
      setRecovering(false);
    }
  }, [user]);

  // When user disappears but we previously had one, try to recover instead of redirecting
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (!lastUserRef.current) return; // never authenticated -> normal redirect
    if (giveUp) return;

    let cancelled = false;
    setRecovering(true);

    const attempt = async () => {
      // Try up to 3 times with backoff
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!cancelled && data?.session) {
            setRecovering(false);
            return;
          }
          if (error) console.warn("[SessionGuard] refresh attempt failed:", error.message);
        } catch (e) {
          console.warn("[SessionGuard] refresh threw:", e);
        }
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
      if (!cancelled) {
        setRecovering(false);
        setGiveUp(true);
      }
    };

    attempt();
    return () => {
      cancelled = true;
    };
  }, [user, loading, giveUp]);

  // Re-attempt on network back / tab focus
  useEffect(() => {
    const retry = () => {
      if (!user && lastUserRef.current && !recovering) {
        setGiveUp(false);
      }
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [user, recovering]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Authenticated -> render normally
  if (user && session) return <>{children}</>;

  // Was authenticated, now trying to recover -> show overlay over previous content if possible
  if (recovering && lastUserRef.current) {
    return (
      <div className="relative">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-5 shadow-lg">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Reconectando sesión…</p>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Gave up or never authenticated -> redirect
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
};
