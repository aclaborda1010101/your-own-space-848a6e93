import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, Shield, Brain } from "lucide-react";
import { isInIframe } from "@/lib/oauth";
import AISpectrum from "@/components/ui/AISpectrum";

const GOOGLE_SCOPES =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let navigated = false;
    const goDashboard = () => {
      if (navigated) return;
      navigated = true;
      // Replace para que el botón "atrás" no devuelva a /login
      navigate("/dashboard", { replace: true });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) goDashboard();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) goDashboard();
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenido de nuevo");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Cuenta creada correctamente");
      }
    } catch (error: any) {
      toast.error(error.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Si estamos en iframe (preview de Lovable), forzamos navegación top-level
    // para evitar el bloqueo de cookies de terceros y el problema de postMessage
    // cross-origin entre la pestaña popup y el iframe original.
    if (isInIframe()) {
      try {
        // window.top puede ser cross-origin; envolvemos en try/catch
        if (window.top) {
          window.top.location.href = `${window.location.origin}/oauth/google`;
          return;
        }
      } catch {
        // fallback: abrir en nueva pestaña
      }
      window.open(`${window.location.origin}/oauth/google`, "_blank");
      toast.info("Se abrió una pestaña para iniciar sesión con Google.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/oauth/google/callback`,
          scopes: GOOGLE_SCOPES,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Error con Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex">
      {/* ─── LEFT PANEL: Brand & Visuals ─── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col items-center justify-center p-12">
        {/* Mesh gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/5" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[180px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[150px]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Concentric rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-primary/[0.06] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/[0.08] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-primary/[0.1] rounded-full" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <div className="w-32 h-32 rounded-3xl bg-card/60 border border-primary/20 flex items-center justify-center mb-8 backdrop-blur-sm shadow-2xl shadow-primary/10">
            <AISpectrum size={100} />
          </div>

          <h1 className="text-5xl font-bold text-foreground tracking-tight mb-3">
            JARVIS
          </h1>
          <p className="text-primary font-mono text-xs tracking-[0.35em] uppercase mb-8">
            Life Operating System
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed mb-10 max-w-sm">
            Tu sistema personal de productividad, finanzas, proyectos y bienestar — potenciado con inteligencia artificial.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { icon: Brain, label: "IA Adaptativa" },
              { icon: Zap, label: "Automatización" },
              { icon: Shield, label: "Privado y Seguro" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/40 border border-border/60 backdrop-blur-sm"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Version tag */}
        <p className="absolute bottom-6 text-[10px] text-muted-foreground/40 font-mono tracking-widest">
          v2.0 — SISTEMA OPERATIVO PERSONAL
        </p>
      </div>

      {/* ─── RIGHT PANEL: Auth Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        {/* Subtle bg for right side */}
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/[0.03] to-transparent" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5 border border-primary/20 mb-4">
              <AISpectrum size={64} />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">JARVIS</h1>
            <p className="text-primary font-mono text-[10px] tracking-[0.3em] mt-1">LIFE OPERATING SYSTEM</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isLogin ? "Accede a tu sistema personal" : "Comienza a organizar tu vida"}
            </p>
          </div>

          {/* Google Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 border-border hover:border-primary/40 hover:bg-primary/5 text-foreground font-medium gap-3 mb-6 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-[10px] text-muted-foreground/60 bg-background font-mono uppercase tracking-wider">
                o con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-card/50 border-border focus:border-primary focus:ring-primary/20 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground text-xs font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 bg-card/50 border-border focus:border-primary focus:ring-primary/20 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all mt-2"
            >
              {loading ? "Procesando..." : isLogin ? "Acceder al sistema" : "Activar cuenta"}
            </Button>
          </form>

          {/* Toggle */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "¿Nuevo en JARVIS?" : "¿Ya tienes cuenta?"}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1.5 text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              {isLogin ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
