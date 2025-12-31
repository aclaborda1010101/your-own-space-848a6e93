import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Sparkles, Shield, Zap } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For MVP, just navigate to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">JARVIS 2.0</h1>
              <p className="text-muted-foreground text-sm">Life Operating System</p>
            </div>
          </div>
          
          <h2 className="text-4xl xl:text-5xl font-bold text-foreground leading-tight mb-6">
            Tu sistema operativo
            <span className="block text-primary">personal inteligente</span>
          </h2>
          
          <p className="text-muted-foreground text-lg mb-10 max-w-md">
            No gestionas la app. La app te gestiona a ti, con criterio y humanidad.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Coaching Personal</p>
                <p className="text-muted-foreground text-sm">Acompañamiento diario adaptativo</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Secretaría Proactiva</p>
                <p className="text-muted-foreground text-sm">Planifica, decide y actúa por ti</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Balance Vida-Trabajo</p>
                <p className="text-muted-foreground text-sm">Sistema dual que protege lo importante</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">JARVIS 2.0</h1>
            <p className="text-muted-foreground text-xs">Life Operating System</p>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto lg:mx-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isLogin ? "Bienvenido de nuevo" : "Crear cuenta"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin 
                ? "Ingresa tus credenciales para acceder" 
                : "Completa los datos para comenzar"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all hover:shadow-lg"
              style={{ boxShadow: "var(--glow-primary)" }}
            >
              {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {isLogin ? "Regístrate" : "Inicia sesión"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
