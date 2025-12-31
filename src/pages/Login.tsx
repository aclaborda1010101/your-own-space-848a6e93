import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Eye, EyeOff } from "lucide-react";
import { isInIframe } from "@/lib/oauth";

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard");
      }
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
    // In embedded previews, start OAuth from a top-level tab to avoid iframe storage issues.
    if (isInIframe()) {
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
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Error con Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px"
          }}
        />
      </div>

      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/10 rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/5 rounded-full" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-4 relative">
            <Brain className="w-10 h-10 text-primary" />
            <div className="absolute inset-0 rounded-2xl border border-primary/50 animate-ping opacity-20" />
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">JARVIS</h1>
          <p className="text-primary font-mono text-sm tracking-widest mt-1">LIFE OPERATING SYSTEM</p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-card/50 border border-border rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? "Accede a tu sistema personal" : "Únete al sistema"}
            </p>
          </div>

          {/* Google Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full h-12 border-border hover:border-primary/50 hover:bg-primary/5 text-foreground font-medium gap-3 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-xs text-muted-foreground bg-card/50 font-mono">O CON EMAIL</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-background/50 border-border focus:border-primary focus:ring-primary/20 font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-background/50 border-border focus:border-primary focus:ring-primary/20 pr-12 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-center">
                <button type="button" className="text-sm text-muted-foreground hover:text-primary transition-colors font-mono">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all relative overflow-hidden group"
            >
              <span className="relative z-10">
                {loading ? "Procesando..." : isLogin ? "Acceder al sistema" : "Activar cuenta"}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "¿Nuevo en JARVIS?" : "¿Ya tienes cuenta?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                {isLogin ? "Crear cuenta" : "Iniciar sesión"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 font-mono">
          SISTEMA OPERATIVO PERSONAL v2.0
        </p>
      </div>
    </div>
  );
};

export default Login;
