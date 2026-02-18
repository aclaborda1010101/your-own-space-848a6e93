import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Gauge,
  Brain,
  Zap,
  Target,
  Sparkles,
  Languages,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb
} from "lucide-react";

interface AgustinAnalysis {
  estado_animo_detectado: string;
  bloqueos_identificados: string[];
  recomendaciones_clave: string[];
  oportunidades_detectadas: string[];
  action_items?: string[];
}

export default function AgustinState() {
  const { isOpen, isCollapsed, toggleCollapse, open, close } = useSidebarState();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AgustinAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestAnalysis();
  }, []);

  const fetchLatestAnalysis = async () => {
    try {
      // Buscar el último análisis de estado en memoria
      const { data, error } = await supabase
        .from('jarvis_memory')
        .select('*')
        .eq('agent_type', 'agustin_state')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.metadata) {
        // Combinar metadata (estado) con content si es necesario, pero metadata debería tener todo
        // El script save-strategic-profile guardó el estado en metadata
        const metadata = data.metadata as any;
        
        // A veces action_items están fuera del objeto de estado en el JSON original
        // Vamos a intentar reconstruir lo mejor posible
        setAnalysis({
          estado_animo_detectado: metadata.estado_animo_detectado || "No detectado",
          bloqueos_identificados: metadata.bloqueos_identificados || [],
          recomendaciones_clave: metadata.recomendaciones_clave || [],
          oportunidades_detectadas: metadata.oportunidades_detectadas || [],
          // Si action_items se guardó en el content string, habría que parsearlo, 
          // pero asumiremos que el script lo guardó bien o en metadata
          action_items: metadata.action_items || [] 
        });
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionButtons = () => {
    if (!analysis) return [];
    
    const state = analysis.estado_animo_detectado.toLowerCase();
    const actions = [];

    // Lógica simple de recomendación basada en palabras clave
    if (state.includes("ansioso") || state.includes("estresado") || state.includes("compulsivo")) {
      actions.push({
        label: "Meditación Guiada",
        icon: Brain,
        path: "/health", // Podría ser una ruta específica de meditación
        color: "bg-blue-500 hover:bg-blue-600",
        desc: "Calmar la mente y recuperar control"
      });
      actions.push({
        label: "Hablar con Coach",
        icon: Sparkles,
        path: "/coach",
        color: "bg-purple-500 hover:bg-purple-600",
        desc: "Estructurar pensamientos"
      });
    }

    if (state.includes("cansado") || state.includes("agotado")) {
      actions.push({
        label: "Descanso Activo",
        icon: Zap,
        path: "/health",
        color: "bg-orange-500 hover:bg-orange-600",
        desc: "Recuperar energía vital"
      });
    }

    if (state.includes("motivado") || state.includes("determinado") || state.includes("foco")) {
      actions.push({
        label: "Clase de Inglés",
        icon: Languages,
        path: "/english",
        color: "bg-green-500 hover:bg-green-600",
        desc: "Aprovechar claridad mental"
      });
      actions.push({
        label: "Gestión Proyectos",
        icon: Target,
        path: "/tasks",
        color: "bg-indigo-500 hover:bg-indigo-600",
        desc: "Ejecutar visión"
      });
    }

    // Default si no hay matches o pocos
    if (actions.length === 0) {
      actions.push({ label: "Hablar con Coach", icon: Sparkles, path: "/coach", color: "bg-purple-500", desc: "Chequeo general" });
      actions.push({ label: "Inglés", icon: Languages, path: "/english", color: "bg-green-500", desc: "Práctica diaria" });
    }

    return actions;
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew 
        isOpen={isOpen} 
        onClose={close}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className={cn("transition-all duration-300", isCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={open} />
        
        <main className="p-4 lg:p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Gauge className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mi Estado (Agustín)</h1>
              <p className="text-sm text-muted-foreground">Diagnóstico en tiempo real y plan de acción</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner text-primary">Cargando análisis...</span>
            </div>
          ) : analysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda: Diagnóstico */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Estado Actual */}
                <Card className="border-l-4 border-l-primary bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Estado Detectado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-2 capitalize">
                      {analysis.estado_animo_detectado}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Basado en tus últimas interacciones y análisis de voz.
                    </p>
                  </CardContent>
                </Card>

                {/* Bloqueos y Oportunidades */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-red-500/5 border-red-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-500">
                        <AlertTriangle className="w-4 h-4" />
                        Bloqueos Identificados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.bloqueos_identificados.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-red-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-500">
                        <Lightbulb className="w-4 h-4" />
                        Oportunidades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.oportunidades_detectadas.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-emerald-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      Plan de Acción Recomendado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {analysis.recomendaciones_clave.map((item, i) => (
                        <li key={i} className="flex gap-3 items-start p-3 rounded-lg bg-accent/30 border border-border/50">
                          <div className="mt-0.5 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

              </div>

              {/* Columna Derecha: Acciones Inmediatas */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="bg-gradient-to-br from-card to-accent/20 border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">¿Qué hacer ahora?</CardTitle>
                    <CardDescription>Acciones sugeridas según tu estado</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getActionButtons().map((action, i) => (
                      <Button
                        key={i}
                        onClick={() => navigate(action.path)}
                        className={cn("w-full justify-start h-auto py-4 px-4 text-white shadow-md transition-all hover:scale-[1.02]", action.color)}
                      >
                        <div className="bg-white/20 p-2 rounded-lg mr-3">
                          <action.icon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-sm">{action.label}</div>
                          <div className="text-xs opacity-90 font-normal">{action.desc}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-card/30 rounded-2xl border border-dashed border-border">
              <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Sin análisis reciente</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                El sistema necesita analizar nuevas conversaciones para generar un diagnóstico de tu estado actual.
              </p>
              <Button onClick={() => window.location.reload()}>
                Actualizar Datos
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
