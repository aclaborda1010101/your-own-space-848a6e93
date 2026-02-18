import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCoachStats } from "@/hooks/useCoachStats";
import { useJarvisCoach } from "@/hooks/useJarvisCoach";
import { CoachSessionDialog } from "@/components/coach/CoachSessionDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Heart,
  Brain,
  Target,
  Flame,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  Play,
  Zap,
  Trophy,
  Calendar,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";

const Coach = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [activeTab, setActiveTab] = useState("reset");
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  
  const {
    stats,
    habits,
    loading,
    incrementStreak,
    addInsight,
    updateGoalProgress,
    completeHabit,
    updateKPI,
    getKPIsByCategory,
  } = useCoachStats();

  const { getRecentSessions } = useJarvisCoach();
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Reset mental state
  const [energy, setEnergy] = useState([5]);
  const [focus, setFocus] = useState([5]);
  const [anxiety, setAnxiety] = useState([3]);
  const [limitingBelief, setLimitingBelief] = useState("");
  const [anchorPhrase, setAnchorPhrase] = useState("Estoy construyendo algo valioso, un paso a la vez.");
  const [isReframing, setIsReframing] = useState(false);

  const loadRecentSessions = async () => {
    setLoadingSessions(true);
    try {
      const sessions = await getRecentSessions(5);
      setRecentSessions(sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleReframe = async () => {
    if (!limitingBelief.trim()) {
      toast.error('Escribe una creencia limitante primero');
      return;
    }
    
    setIsReframing(true);
    try {
      // Use AI to reframe the belief
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          sessionType: 'reframe',
          message: `Reencuadra esta creencia limitante de forma breve y potente (max 2 frases): "${limitingBelief}"`,
          emotionalState: { energy: energy[0], focus: focus[0], anxiety: anxiety[0] },
        }),
      });

      if (!response.ok) throw new Error('Error en el reencuadre');
      
      const data = await response.json();
      if (data.response) {
        setAnchorPhrase(data.response);
        await addInsight();
        toast.success('Creencia reencuadrada');
      }
    } catch (error) {
      console.error('Error reframing:', error);
      // Fallback to local reframe
      const reframes = [
        "El tiempo es una elección. Elijo invertirlo en lo que importa.",
        "Mi progreso es constante, aunque no siempre sea visible.",
        "Cada pequeño paso me acerca a mi objetivo.",
        "Tengo todo lo que necesito para avanzar hoy.",
      ];
      setAnchorPhrase(reframes[Math.floor(Math.random() * reframes.length)]);
      toast.success('Creencia reencuadrada');
    } finally {
      setIsReframing(false);
    }
  };

  const handleStartSession = () => {
    setSessionDialogOpen(true);
    loadRecentSessions();
  };

  const negocioKPIs = getKPIsByCategory('negocio');
  const contenidoKPIs = getKPIsByCategory('contenido');
  const saludKPIs = getKPIsByCategory('salud');

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
          <Breadcrumbs />
          
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Heart className="w-6 h-6 text-rose-500" />
                Coach Personal
              </h1>
              <p className="text-muted-foreground mt-1">
                Reset mental, hoja de ruta y seguimiento de crecimiento
              </p>
            </div>
            <Button className="gap-2" onClick={handleStartSession}>
              <MessageSquare className="h-4 w-4" />
              Sesión guiada
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.streak_days || 0}</p>
                    <p className="text-xs text-muted-foreground">Días de racha</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.goal_progress || 0}%</p>
                    <p className="text-xs text-muted-foreground">Objetivo 90 días</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.total_sessions || 0}</p>
                    <p className="text-xs text-muted-foreground">Sesiones este mes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.total_insights || 0}</p>
                    <p className="text-xs text-muted-foreground">Insights guardados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="reset" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reset
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2">
                <Target className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger value="session" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Sesión
              </TabsTrigger>
              <TabsTrigger value="scoreboard" className="gap-2">
                <Trophy className="h-4 w-4" />
                Scoreboard
              </TabsTrigger>
            </TabsList>

            {/* Reset Mental */}
            <TabsContent value="reset" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Estado actual</CardTitle>
                    <CardDescription>¿Cómo te encuentras ahora mismo?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Energía</label>
                        <span className="text-sm text-muted-foreground">{energy[0]}/10</span>
                      </div>
                      <Slider value={energy} onValueChange={setEnergy} max={10} step={1} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Foco</label>
                        <span className="text-sm text-muted-foreground">{focus[0]}/10</span>
                      </div>
                      <Slider value={focus} onValueChange={setFocus} max={10} step={1} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Ansiedad</label>
                        <span className="text-sm text-muted-foreground">{anxiety[0]}/10</span>
                      </div>
                      <Slider value={anxiety} onValueChange={setAnxiety} max={10} step={1} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Creencia limitante del día</CardTitle>
                    <CardDescription>¿Qué pensamiento te está frenando?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Ej: 'No tengo tiempo suficiente para hacer todo'"
                      value={limitingBelief}
                      onChange={(e) => setLimitingBelief(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button 
                      className="w-full gap-2" 
                      onClick={handleReframe}
                      disabled={isReframing || !limitingBelief.trim()}
                    >
                      {isReframing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      Reencuadrar
                    </Button>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2 border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Frase ancla del día
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium text-center py-4 italic">
                      "{anchorPhrase}"
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => {
                        const phrases = [
                          "Cada día es una oportunidad de mejora.",
                          "Mi enfoque determina mi resultado.",
                          "Pequeños pasos, grandes cambios.",
                          "Estoy exactamente donde necesito estar.",
                        ];
                        setAnchorPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generar nueva frase
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Roadmap */}
            <TabsContent value="roadmap" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Objetivo 90 días
                    </span>
                    <Badge>{stats?.goal_progress || 0}% completado</Badge>
                  </CardTitle>
                  <CardDescription>
                    {stats?.goal_90_days || 'Define tu objetivo de 90 días'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={stats?.goal_progress || 0} className="mb-4" />
                  
                  <div className="flex gap-2 mb-4">
                    {[25, 50, 75, 100].map(val => (
                      <Button 
                        key={val}
                        variant="outline" 
                        size="sm"
                        onClick={() => updateGoalProgress(val)}
                        disabled={loading}
                      >
                        {val}%
                      </Button>
                    ))}
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">3 Palancas de crecimiento</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="font-medium">Ventas</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Sistema de captación automático</p>
                        <Progress value={negocioKPIs.length > 0 ? (negocioKPIs.reduce((a, k) => a + (k.value / k.target * 100), 0) / negocioKPIs.length) : 0} className="mt-2" />
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-warning" />
                          <span className="font-medium">Producto</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Curso de IA + consultorías</p>
                        <Progress value={80} className="mt-2" />
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-4 w-4 text-rose-500" />
                          <span className="font-medium">Contenido</span>
                        </div>
                        <p className="text-sm text-muted-foreground">5 stories/semana + 3 posts</p>
                        <Progress value={contenidoKPIs.length > 0 ? (contenidoKPIs.reduce((a, k) => a + (k.value / k.target * 100), 0) / contenidoKPIs.length) : 0} className="mt-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-warning/30 bg-warning/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-warning" />
                    Acción P0 de hoy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Grabar video de presentación del curso</p>
                      <p className="text-sm text-muted-foreground">Duración estimada: 2h · Impacto: Alto</p>
                    </div>
                    <Button className="gap-2" onClick={incrementStreak}>
                      <Play className="h-4 w-4" />
                      Empezar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Session */}
            <TabsContent value="session" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Sesión Guiada
                  </CardTitle>
                  <CardDescription>
                    20-30 minutos de coaching con preguntas potentes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col items-start gap-2"
                      onClick={handleStartSession}
                    >
                      <span className="font-medium">Reset rápido</span>
                      <span className="text-xs text-muted-foreground">5 minutos para recentrarte</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col items-start gap-2"
                      onClick={handleStartSession}
                    >
                      <span className="font-medium">Desbloqueo</span>
                      <span className="text-xs text-muted-foreground">Superar un obstáculo mental</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col items-start gap-2"
                      onClick={handleStartSession}
                    >
                      <span className="font-medium">Revisión semanal</span>
                      <span className="text-xs text-muted-foreground">Análisis y ajustes</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col items-start gap-2"
                      onClick={handleStartSession}
                    >
                      <span className="font-medium">Sesión profunda</span>
                      <span className="text-xs text-muted-foreground">Trabajo de creencias y valores</span>
                    </Button>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Sesiones recientes
                    </h4>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {loadingSessions ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : recentSessions.length > 0 ? (
                          recentSessions.map((session, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-card flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{session.date}</Badge>
                                  <span className="text-sm font-medium">{session.session_type}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{session.summary || 'Sin resumen'}</p>
                              </div>
                              <Button variant="ghost" size="sm">
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground py-4">No hay sesiones recientes</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Microreto */}
              <Card className="border-success/30 bg-success/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-success" />
                    Microreto 24h
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Publicar 1 story sin pensar más de 2 minutos</p>
                      <p className="text-sm text-muted-foreground">Objetivo: reducir fricción creativa</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={incrementStreak}>
                      <CheckCircle2 className="h-4 w-4" />
                      Completar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scoreboard */}
            <TabsContent value="scoreboard" className="space-y-4">
              {/* Habits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-rose-500" />
                    Racha de Hábitos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {habits.map(habit => (
                      <div key={habit.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{habit.name}</p>
                          <p className="text-sm text-muted-foreground">{habit.streak}/{habit.target} días</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(habit.streak / habit.target) * 100} className="w-20" />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => completeHabit(habit.name)}
                            disabled={loading}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* KPIs */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      KPIs Negocio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {negocioKPIs.map(kpi => (
                      <div key={kpi.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target}{kpi.unit}</span>
                        </div>
                        <Progress value={(kpi.value / kpi.target) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      KPIs Contenido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contenidoKPIs.map(kpi => (
                      <div key={kpi.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target}{kpi.unit}</span>
                        </div>
                        <Progress value={(kpi.value / kpi.target) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-500" />
                      KPIs Salud
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {saludKPIs.map(kpi => (
                      <div key={kpi.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target}{kpi.unit}</span>
                        </div>
                        <Progress value={(kpi.value / kpi.target) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <CoachSessionDialog 
        open={sessionDialogOpen} 
        onOpenChange={setSessionDialogOpen}
      />
    </div>
  );
};

export default Coach;
