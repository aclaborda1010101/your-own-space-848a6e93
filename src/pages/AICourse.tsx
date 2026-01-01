import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useAICourse } from "@/hooks/useAICourse";
import { cn } from "@/lib/utils";
import {
  Brain,
  Sparkles,
  Target,
  BookOpen,
  Rocket,
  CheckCircle2,
  Clock,
  Play,
  Lock,
  Zap,
  FileText,
  RefreshCw,
  Loader2,
} from "lucide-react";

// Skills data structure
const SKILLS_CONFIG = [
  { 
    id: "prompting", 
    name: "Prompting Efectivo", 
    description: "Técnicas avanzadas de ingeniería de prompts",
  },
  { 
    id: "automation", 
    name: "Automatización", 
    description: "Zapier, Make, n8n y workflows",
  },
  { 
    id: "apis", 
    name: "APIs y Webhooks", 
    description: "Integración de servicios externos",
  },
  { 
    id: "video", 
    name: "Video Content System", 
    description: "Guiones, edición, plantillas, subtítulos",
  },
  { 
    id: "app-building", 
    name: "App Building", 
    description: "Lovable + backend + auth + db",
  },
  { 
    id: "data", 
    name: "Gestión de Datos", 
    description: "Sheets, Airtable, Supabase",
  },
];

const PROJECTS_CONFIG = [
  {
    id: "content-60",
    name: "Sistema de contenido en 60 min",
    description: "Guion → Voz → Edición → Subtítulos → Publicación",
    skills: ["video", "automation"],
  },
  {
    id: "secretary-agent",
    name: "Agente de Secretaría",
    description: "Inbox + tareas + agenda + recordatorios",
    skills: ["apis", "automation"],
  },
  {
    id: "lovable-app",
    name: "Mini App en Lovable",
    description: "Auth + dashboard + logs + analytics",
    skills: ["app-building", "data"],
  },
  {
    id: "leads-automation",
    name: "Automatización Leads",
    description: "Formulario → CRM → WhatsApp/Email → Pipeline",
    skills: ["automation", "apis"],
  },
];

const LESSONS_CONFIG = [
  { id: 1, title: "Fundamentos de Prompting", duration: "45 min" },
  { id: 2, title: "Chain of Thought", duration: "30 min" },
  { id: 3, title: "System Prompts Avanzados", duration: "50 min" },
  { id: 4, title: "Agentes y Tool Calling", duration: "60 min" },
  { id: 5, title: "RAG y Embeddings", duration: "55 min" },
];

const AICourse = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [activeTab, setActiveTab] = useState("roadmap");
  
  const {
    loading,
    streak,
    updateSkillProgress,
    completeLesson,
    updateProjectProgress,
    getSkillProgress,
    getSkillStatus,
    isLessonCompleted,
    getProjectProgress,
    getProjectStatus,
    refetch,
  } = useAICourse();

  const completedSkills = SKILLS_CONFIG.filter(s => getSkillStatus(s.id) === "completed").length;
  const totalProgress = Math.round(SKILLS_CONFIG.reduce((acc, s) => acc + getSkillProgress(s.id), 0) / SKILLS_CONFIG.length);
  const completedLessons = LESSONS_CONFIG.filter(l => isLessonCompleted(l.id)).length;
  const completedProjects = PROJECTS_CONFIG.filter(p => getProjectStatus(p.id) === "completed").length;

  const handleStartLesson = async (lessonId: number) => {
    // Mark lesson as completed when started (simulating completion)
    await completeLesson(lessonId);
  };

  const handleStartProject = async (projectId: string) => {
    const currentProgress = getProjectProgress(projectId);
    if (currentProgress === 0) {
      await updateProjectProgress(projectId, 25, 'active');
    } else if (currentProgress < 100) {
      await updateProjectProgress(projectId, Math.min(currentProgress + 25, 100));
    }
  };

  const handleUpdateSkill = async (skillId: string) => {
    const currentProgress = getSkillProgress(skillId);
    await updateSkillProgress(skillId, Math.min(currentProgress + 10, 100));
  };

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
                <Brain className="w-6 h-6 text-primary" />
                Curso de IA
              </h1>
              <p className="text-muted-foreground mt-1">
                Aprende IA aplicada con proyectos reales y contenido que se autoactualiza
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Progreso global</p>
                <p className="text-2xl font-bold text-primary">{totalProgress}%</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={refetch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedSkills}/{SKILLS_CONFIG.length}</p>
                    <p className="text-xs text-muted-foreground">Skills dominados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedProjects}</p>
                    <p className="text-xs text-muted-foreground">Proyectos completados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedLessons}/{LESSONS_CONFIG.length}</p>
                    <p className="text-xs text-muted-foreground">Lecciones</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{streak}</p>
                    <p className="text-xs text-muted-foreground">Días de racha</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="roadmap" className="gap-2">
                <Target className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger value="lessons" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Lecciones
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <Rocket className="h-4 w-4" />
                Proyectos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roadmap" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Skills (Perennes)
                  </CardTitle>
                  <CardDescription>
                    Habilidades fundamentales que se actualizan con las últimas novedades
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {SKILLS_CONFIG.map(skill => {
                    const progress = getSkillProgress(skill.id);
                    const status = getSkillStatus(skill.id);
                    return (
                      <div key={skill.id} className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {skill.name}
                              {status === "completed" && (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">{skill.description}</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleUpdateSkill(skill.id)}
                            disabled={loading || status === "completed"}
                          >
                            +10%
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="flex-1" />
                          <span className="text-sm font-medium">{progress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lessons" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Lecciones del Curso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {LESSONS_CONFIG.map((lesson, index) => {
                        const completed = isLessonCompleted(lesson.id);
                        return (
                          <div 
                            key={lesson.id}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                              completed ? "bg-success/5 border-success/20" : "hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              completed ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {completed ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <span className="font-medium">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{lesson.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {lesson.duration}
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant={completed ? "outline" : "default"}
                              className="gap-2"
                              onClick={() => handleStartLesson(lesson.id)}
                              disabled={loading}
                            >
                              {completed ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Completada
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  Empezar
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {PROJECTS_CONFIG.map(project => {
                  const progress = getProjectProgress(project.id);
                  const status = getProjectStatus(project.id);
                  return (
                    <Card key={project.id} className={cn(
                      status === "completed" && "border-success/30"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : status === "active" ? (
                              <Rocket className="h-5 w-5 text-primary" />
                            ) : (
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            )}
                            {project.name}
                          </CardTitle>
                          <Badge variant={
                            status === "completed" ? "default" :
                            status === "active" ? "secondary" : "outline"
                          }>
                            {status === "completed" ? "Completado" :
                             status === "active" ? "En curso" : "Pendiente"}
                          </Badge>
                        </div>
                        <CardDescription>{project.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {project.skills.map(skillId => {
                            const skill = SKILLS_CONFIG.find(s => s.id === skillId);
                            return skill ? (
                              <Badge key={skillId} variant="outline" className="text-xs">
                                {skill.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="flex-1" />
                          <span className="text-sm font-medium">{progress}%</span>
                        </div>
                        <Button 
                          className="w-full mt-3 gap-2" 
                          variant={status === "completed" ? "outline" : "default"} 
                          size="sm"
                          onClick={() => handleStartProject(project.id)}
                          disabled={loading || status === "completed"}
                        >
                          {status === "completed" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Completado
                            </>
                          ) : status === "active" ? (
                            <>
                              <Play className="h-4 w-4" />
                              Continuar (+25%)
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4" />
                              Empezar proyecto
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AICourse;
