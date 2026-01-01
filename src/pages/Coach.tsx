import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
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
  Clock,
  ArrowRight,
} from "lucide-react";

// Scoreboard data
const HABITS = [
  { name: "Meditación", streak: 12, target: 30 },
  { name: "Ejercicio", streak: 5, target: 7 },
  { name: "Lectura", streak: 8, target: 14 },
  { name: "Journaling", streak: 3, target: 7 },
];

const KPIs = {
  negocio: [
    { name: "Leads generados", value: 15, target: 20, unit: "leads" },
    { name: "Propuestas enviadas", value: 3, target: 5, unit: "" },
    { name: "Cierres", value: 1, target: 2, unit: "" },
  ],
  contenido: [
    { name: "Stories publicadas", value: 4, target: 5, unit: "/semana" },
    { name: "Posts LinkedIn", value: 2, target: 3, unit: "/semana" },
  ],
  salud: [
    { name: "Días de entreno", value: 3, target: 4, unit: "/semana" },
    { name: "Horas de sueño", value: 6.5, target: 7.5, unit: "h avg" },
  ],
};

const Coach = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [activeTab, setActiveTab] = useState("reset");
  
  // Reset mental state
  const [energy, setEnergy] = useState([5]);
  const [focus, setFocus] = useState([5]);
  const [anxiety, setAnxiety] = useState([3]);
  const [limitingBelief, setLimitingBelief] = useState("");
  const [anchorPhrase, setAnchorPhrase] = useState("Estoy construyendo algo valioso, un paso a la vez.");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
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
            <Button className="gap-2">
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
                    <p className="text-2xl font-bold">12</p>
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
                    <p className="text-2xl font-bold">67%</p>
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
                    <p className="text-2xl font-bold">8</p>
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
                    <p className="text-2xl font-bold">15</p>
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
                    <Button className="w-full gap-2">
                      <Brain className="h-4 w-4" />
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
                    <Button variant="outline" className="w-full mt-2">
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
                    <Badge>67% completado</Badge>
                  </CardTitle>
                  <CardDescription>
                    Escalar el negocio a 10k€/mes con sistema de contenido + productos digitales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={67} className="mb-4" />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">3 Palancas de crecimiento</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="font-medium">Ventas</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Sistema de captación automático con Jarvis + CRM</p>
                        <Progress value={45} className="mt-2" />
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-warning" />
                          <span className="font-medium">Producto</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Curso de IA + consultorías personalizadas</p>
                        <Progress value={80} className="mt-2" />
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-4 w-4 text-rose-500" />
                          <span className="font-medium">Contenido</span>
                        </div>
                        <p className="text-sm text-muted-foreground">5 stories/semana + 3 posts LinkedIn</p>
                        <Progress value={60} className="mt-2" />
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
                    <Button className="gap-2">
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
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                      <span className="font-medium">Reset rápido</span>
                      <span className="text-xs text-muted-foreground">5 minutos para recentrarte</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                      <span className="font-medium">Desbloqueo</span>
                      <span className="text-xs text-muted-foreground">Superar un obstáculo mental</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                      <span className="font-medium">Revisión semanal</span>
                      <span className="text-xs text-muted-foreground">Análisis y ajustes</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
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
                        {[
                          { date: "Hoy", type: "Reset rápido", insight: "Identificado patrón de procrastinación matutina" },
                          { date: "Ayer", type: "Desbloqueo", insight: "Reencuadre de creencia sobre el tiempo" },
                          { date: "Hace 3 días", type: "Revisión semanal", insight: "KPIs de contenido por debajo, ajustar horario" },
                        ].map((session, i) => (
                          <div key={i} className="p-3 rounded-lg border bg-card flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{session.date}</Badge>
                                <span className="text-sm font-medium">{session.type}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{session.insight}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
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
                  <p className="font-medium">Publicar 1 story antes de las 12:00</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Quedan 4h 32m</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scoreboard */}
            <TabsContent value="scoreboard" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="h-5 w-5 text-rose-500" />
                      Racha de Hábitos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {HABITS.map(habit => (
                      <div key={habit.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-bold">{habit.streak}</span>
                          </div>
                          <span className="font-medium">{habit.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(habit.streak / habit.target) * 100} className="w-20" />
                          <span className="text-xs text-muted-foreground">{habit.streak}/{habit.target}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-success" />
                      KPIs Negocio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {KPIs.negocio.map(kpi => (
                      <div key={kpi.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target} {kpi.unit}</span>
                        </div>
                        <Progress value={(kpi.value / kpi.target) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-warning" />
                      KPIs Contenido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {KPIs.contenido.map(kpi => (
                      <div key={kpi.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target} {kpi.unit}</span>
                        </div>
                        <Progress value={(kpi.value / kpi.target) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Heart className="h-5 w-5 text-rose-500" />
                      KPIs Salud
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {KPIs.salud.map(kpi => (
                      <div key={kpi.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{kpi.name}</span>
                          <span className="font-medium">{kpi.value}/{kpi.target} {kpi.unit}</span>
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
    </div>
  );
};

export default Coach;
