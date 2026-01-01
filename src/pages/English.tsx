import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useEnglishStats } from "@/hooks/useEnglishStats";
import { cn } from "@/lib/utils";
import { ShadowingActivity } from "@/components/english/ShadowingActivity";
import { ChunksPractice } from "@/components/english/ChunksPractice";
import { RoleplayActivity } from "@/components/english/RoleplayActivity";
import { MiniTestActivity } from "@/components/english/MiniTestActivity";
import { BoscoGameActivity } from "@/components/english/BoscoGameActivity";
import {
  Languages,
  Target,
  BookOpen,
  Mic,
  Play,
  CheckCircle2,
  Clock,
  Flame,
  Baby,
  MessageSquare,
  Headphones,
  PenTool,
  Calendar,
  Volume2,
  Gamepad,
  Award,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const DAILY_PRACTICE = [
  { id: "shadowing", name: "Shadowing", duration: "10 min", icon: Headphones, completed: false },
  { id: "chunks", name: "10 Chunks nuevos", duration: "10 min", icon: BookOpen, completed: false },
  { id: "roleplay", name: "Role-play situacional", duration: "5 min", icon: MessageSquare, completed: false },
  { id: "test", name: "Mini test", duration: "3 min", icon: PenTool, completed: false },
  { id: "bosco", name: "Inglés con Bosco", duration: "5 min", icon: Baby, completed: false },
];

const CHUNKS = [
  // Expresiones de tiempo y frecuencia
  { en: "I'm looking forward to", es: "Tengo ganas de / Estoy deseando", example: "I'm looking forward to the weekend." },
  { en: "It's worth it", es: "Vale la pena", example: "The long drive is worth it." },
  { en: "I'm about to", es: "Estoy a punto de", example: "I'm about to leave the office." },
  { en: "It depends on", es: "Depende de", example: "It depends on the weather." },
  { en: "Every now and then", es: "De vez en cuando", example: "Every now and then I go for a run." },
  { en: "Sooner or later", es: "Tarde o temprano", example: "Sooner or later, you'll have to decide." },
  { en: "In the meantime", es: "Mientras tanto", example: "In the meantime, let's have coffee." },
  { en: "At the last minute", es: "En el último momento", example: "He cancelled at the last minute." },
  // Opiniones y preferencias
  { en: "As far as I know", es: "Que yo sepa", example: "As far as I know, the meeting is at 3." },
  { en: "To be honest", es: "Siendo sincero", example: "To be honest, I prefer the blue one." },
  { en: "I'd rather", es: "Preferiría", example: "I'd rather stay home tonight." },
  { en: "I'm not sure if", es: "No estoy seguro de si", example: "I'm not sure if I can make it." },
  { en: "The thing is", es: "El tema es que", example: "The thing is, I forgot my wallet." },
  // Conversación natural
  { en: "By the way", es: "Por cierto", example: "By the way, did you call her?" },
  { en: "Speaking of which", es: "Hablando de eso", example: "Speaking of which, have you seen the news?" },
  { en: "What I mean is", es: "Lo que quiero decir es", example: "What I mean is, we need more time." },
  { en: "Let me put it this way", es: "Déjame decirlo así", example: "Let me put it this way: it's complicated." },
  { en: "That reminds me", es: "Eso me recuerda", example: "That reminds me, I need to call my mom." },
  // Situaciones cotidianas
  { en: "I can't help but", es: "No puedo evitar", example: "I can't help but laugh at his jokes." },
  { en: "It turns out that", es: "Resulta que", example: "It turns out that he was right." },
  { en: "There's no point in", es: "No tiene sentido", example: "There's no point in waiting any longer." },
  { en: "I'm running late", es: "Voy con retraso", example: "Sorry, I'm running late for the meeting." },
  { en: "Make yourself at home", es: "Estás en tu casa", example: "Come in, make yourself at home." },
  // Trabajo y negocios
  { en: "As soon as possible", es: "Lo antes posible", example: "I need this done as soon as possible." },
  { en: "On the other hand", es: "Por otro lado", example: "On the other hand, it could be a good opportunity." },
  { en: "Keep in mind that", es: "Ten en cuenta que", example: "Keep in mind that deadlines are tight." },
  { en: "From my point of view", es: "Desde mi punto de vista", example: "From my point of view, we should wait." },
  { en: "Let's get started", es: "Empecemos", example: "Alright everyone, let's get started." },
  { en: "I'm used to", es: "Estoy acostumbrado a", example: "I'm used to waking up early." },
];

const SITUATIONS = [
  { name: "Reunión de colegio", description: "Hablar con el profesor de Bosco sobre su progreso", level: "Intermedio" },
  { name: "Llamada cliente", description: "Presentar propuesta de consultoría en inglés", level: "Avanzado" },
  { name: "Email formal", description: "Responder a un potencial colaborador", level: "Intermedio" },
  { name: "Conversación casual", description: "Charla con vecino expatriado", level: "Básico" },
];

const English = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [activeTab, setActiveTab] = useState("practice");
  const [practiceItems, setPracticeItems] = useState(DAILY_PRACTICE);
  
  const { stats, chunks, loading, recordShadowingSession, recordRoleplaySession, recordMiniTest, recordBoscoGame, generateNewChunks, needsMoreChunks } = useEnglishStats();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Activity dialog states
  const [shadowingOpen, setShadowingOpen] = useState(false);
  const [chunksOpen, setChunksOpen] = useState(false);
  const [roleplayOpen, setRoleplayOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [boscoOpen, setBoscoOpen] = useState(false);
  const [selectedSituation, setSelectedSituation] = useState(SITUATIONS[0]);

  const markComplete = (id: string) => {
    setPracticeItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: true } : item
    ));
    // Record stats based on activity
    if (id === "shadowing") recordShadowingSession(10);
    if (id === "roleplay") recordRoleplaySession(5);
    if (id === "test") recordMiniTest();
    if (id === "bosco") recordBoscoGame(5);
    toast.success("Actividad completada");
  };

  const startActivity = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    switch (id) {
      case "shadowing": setShadowingOpen(true); break;
      case "chunks": setChunksOpen(true); break;
      case "roleplay": setRoleplayOpen(true); break;
      case "test": setTestOpen(true); break;
      case "bosco": setBoscoOpen(true); break;
    }
  };

  const handleGenerateChunks = async () => {
    setIsGenerating(true);
    try {
      await generateNewChunks(undefined, 15);
    } finally {
      setIsGenerating(false);
    }
  };

  const completedPractice = practiceItems.filter(p => p.completed).length;
  const practiceProgress = (completedPractice / practiceItems.length) * 100;
  const unmasteredChunks = chunks.filter(c => !c.mastered).length;

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
                <Languages className="w-6 h-6 text-primary" />
                Inglés
              </h1>
              <p className="text-muted-foreground mt-1">
                Práctica diaria adaptada a tu vida real
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Objetivo 90 días</p>
                <p className="text-lg font-bold text-primary">Hablar con confianza</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-primary" />
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
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.total_chunks_learned || 0}</p>
                    <p className="text-xs text-muted-foreground">Chunks aprendidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{Math.floor((stats?.total_practice_minutes || 0) / 60)}h</p>
                    <p className="text-xs text-muted-foreground">Tiempo total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Baby className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.bosco_games_played || 0}</p>
                    <p className="text-xs text-muted-foreground">Sesiones con Bosco</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Chunks Generator Alert */}
          {(needsMoreChunks() || unmasteredChunks < 10) && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">¡Necesitas más chunks!</p>
                      <p className="text-sm text-muted-foreground">
                        Solo te quedan {unmasteredChunks} chunks por dominar. Genera más con IA.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateChunks} 
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generar 15 chunks
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Today's Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Progreso de hoy</span>
                <span className="text-sm text-muted-foreground">{completedPractice}/{practiceItems.length} completadas</span>
              </div>
              <Progress value={practiceProgress} />
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="practice" className="gap-2">
                <Play className="h-4 w-4" />
                Práctica
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2">
                <Target className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger value="chunks" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Chunks
              </TabsTrigger>
              <TabsTrigger value="bosco" className="gap-2">
                <Baby className="h-4 w-4" />
                Con Bosco
              </TabsTrigger>
            </TabsList>

            {/* Daily Practice */}
            <TabsContent value="practice" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Rutina Diaria
                  </CardTitle>
                  <CardDescription>Completa tu práctica de hoy (~33 min)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {practiceItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div 
                        key={item.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                          item.completed ? "bg-success/5 border-success/30" : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox checked={item.completed} onCheckedChange={() => markComplete(item.id)} />
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          item.completed ? "bg-success/20" : "bg-muted"
                        )}>
                          <ItemIcon className={cn(
                            "h-5 w-5",
                            item.completed ? "text-success" : "text-muted-foreground"
                          )} />
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium",
                            item.completed && "line-through text-muted-foreground"
                          )}>{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.duration}</p>
                        </div>
                        {!item.completed && (
                          <Button size="sm" className="gap-2" onClick={(e) => startActivity(item.id, e)}>
                            <Play className="h-4 w-4" />
                            Empezar
                          </Button>
                        )}
                        {item.completed && (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Today's Situation */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Situación del día
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">Intermedio</Badge>
                      <h4 className="font-medium">Reunión de colegio</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Hablar con el profesor de Bosco sobre su progreso
                      </p>
                    </div>
                    <Button className="gap-2" onClick={() => { setSelectedSituation(SITUATIONS[0]); setRoleplayOpen(true); }}>
                      <Mic className="h-4 w-4" />
                      Practicar
                    </Button>
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-background/50">
                    <p className="text-sm font-medium mb-2">Vocabulario clave:</p>
                    <div className="flex flex-wrap gap-2">
                      {["progress report", "behavior", "participation", "homework", "parent-teacher meeting"].map(word => (
                        <Badge key={word} variant="outline" className="text-xs">{word}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Roadmap */}
            <TabsContent value="roadmap" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Objetivo 90 días: Hablar con confianza
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={60} className="mb-4" />
                  
                  <div className="space-y-3">
                    {[
                      { week: "Semanas 1-4", goal: "Fundamentos y chunks básicos", progress: 100, status: "completed" },
                      { week: "Semanas 5-8", goal: "Situaciones cotidianas", progress: 80, status: "in_progress" },
                      { week: "Semanas 9-12", goal: "Conversaciones profesionales", progress: 0, status: "locked" },
                    ].map((phase, i) => (
                      <div key={i} className={cn(
                        "p-4 rounded-lg border",
                        phase.status === "completed" && "border-success/30 bg-success/5",
                        phase.status === "in_progress" && "border-primary/30 bg-primary/5",
                        phase.status === "locked" && "opacity-50"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {phase.status === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                            {phase.status === "in_progress" && <Play className="h-4 w-4 text-primary" />}
                            <span className="font-medium">{phase.week}</span>
                          </div>
                          <Badge variant={phase.status === "completed" ? "default" : "outline"}>
                            {phase.progress}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{phase.goal}</p>
                        <Progress value={phase.progress} className="mt-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chunks */}
            <TabsContent value="chunks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Chunks de hoy
                  </CardTitle>
                  <CardDescription>Frases hechas y expresiones idiomáticas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {CHUNKS.map((chunk, i) => (
                        <div key={i} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-lg">{chunk.en}</p>
                              <p className="text-muted-foreground">{chunk.es}</p>
                              <p className="text-sm text-primary mt-2 italic">"{chunk.example}"</p>
                            </div>
                            <Button size="icon" variant="ghost">
                              <Volume2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bosco */}
            <TabsContent value="bosco" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Baby className="h-5 w-5 text-rose-500" />
                    Inglés con Bosco
                  </CardTitle>
                  <CardDescription>5 minutos sin pantallas, aprendiendo juntos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                      <Gamepad className="h-8 w-8 text-primary" />
                      <span className="font-medium">Simon Says</span>
                      <span className="text-xs text-muted-foreground">Instrucciones en inglés</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                      <BookOpen className="h-8 w-8 text-success" />
                      <span className="font-medium">Story Time</span>
                      <span className="text-xs text-muted-foreground">Cuento corto bilingüe</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                      <Mic className="h-8 w-8 text-warning" />
                      <span className="font-medium">Sing Along</span>
                      <span className="text-xs text-muted-foreground">Canción infantil</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                      <MessageSquare className="h-8 w-8 text-rose-500" />
                      <span className="font-medium">Daily Words</span>
                      <span className="text-xs text-muted-foreground">5 palabras del día</span>
                    </Button>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4 text-warning" />
                      Logros con Bosco
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {["Colores", "Números 1-10", "Animales", "Familia", "Comida"].map(badge => (
                        <Badge key={badge} variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {badge}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="opacity-50">Transporte</Badge>
                      <Badge variant="outline" className="opacity-50">Ropa</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Activity Dialogs */}
          <ShadowingActivity open={shadowingOpen} onOpenChange={setShadowingOpen} onComplete={() => markComplete("shadowing")} />
          <ChunksPractice open={chunksOpen} onOpenChange={setChunksOpen} onComplete={() => markComplete("chunks")} />
          <RoleplayActivity open={roleplayOpen} onOpenChange={setRoleplayOpen} onComplete={() => markComplete("roleplay")} situation={selectedSituation} />
          <MiniTestActivity open={testOpen} onOpenChange={setTestOpen} onComplete={() => markComplete("test")} />
          <BoscoGameActivity open={boscoOpen} onOpenChange={setBoscoOpen} onComplete={() => markComplete("bosco")} />
        </main>
      </div>
    </div>
  );
};

export default English;
