import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JarvisVoiceButton } from "@/components/voice/JarvisVoiceButton";
import { PomodoroButton } from "@/components/pomodoro/PomodoroButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  CheckSquare, 
  Briefcase, 
  Heart, 
  Wallet,
  Clock,
  Calendar,
  Trash2,
  Loader2,
  Timer
} from "lucide-react";

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/10 text-primary border-primary/20" },
  life: { icon: Heart, label: "Vida", color: "bg-success/10 text-success border-success/20" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/10 text-warning border-warning/20" },
};

const priorityColors = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
};

const Tasks = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"work" | "life" | "finance">("work");
  const [view, setView] = useState<"today" | "week">("today");

  const { 
    pendingTasks, 
    completedTasks, 
    loading, 
    addTask, 
    toggleComplete, 
    deleteTask 
  } = useTasks();

  const { createEvent, connected: calendarConnected } = useGoogleCalendar();

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    await addTask({
      title: newTaskTitle,
      type: newTaskType,
      priority: "P1",
      duration: 30,
    });

    setNewTaskTitle("");
  };

  const convertToBlock = async (taskTitle: string, duration: number) => {
    if (!calendarConnected) {
      return;
    }

    // Calculate next available time slot (round to next 30 min)
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? 30 : 0;
    const hours = minutes < 30 ? now.getHours() : now.getHours() + 1;
    const time = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;

    await createEvent({
      title: taskTitle,
      time,
      duration,
      description: 'Creado desde JARVIS',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO TAREAS...</p>
        </div>
      </div>
    );
  }

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
        
        <main className="p-4 lg:p-6 space-y-6">
          <Breadcrumbs />
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tareas</h1>
                <p className="text-sm text-muted-foreground font-mono">{pendingTasks.length} PENDIENTES</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={view === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("today")}
                className={view === "today" ? "bg-primary text-primary-foreground" : "border-border"}
              >
                Hoy
              </Button>
              <Button
                variant={view === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("week")}
                className={view === "week" ? "bg-primary text-primary-foreground" : "border-border"}
              >
                Semana
              </Button>
            </div>
          </div>

          {/* Add Task */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Nueva tarea..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  className="flex-1 h-11 bg-background border-border font-mono"
                />
                
                <div className="flex gap-2">
                  {(["work", "life", "finance"] as const).map((type) => {
                    const config = typeConfig[type];
                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTaskType(type)}
                        className={`h-11 px-3 ${newTaskType === type ? config.color : "border-border text-muted-foreground"}`}
                      >
                        <config.icon className="w-4 h-4" />
                      </Button>
                    );
                  })}
                </div>

                <Button 
                  onClick={handleAddTask}
                  className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Añadir
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pending */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground font-mono">
                  PENDIENTES ({pendingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay tareas pendientes
                  </p>
                ) : (
                  pendingTasks.map((task) => {
                    const TypeIcon = typeConfig[task.type].icon;
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-all group"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => toggleComplete(task.id)}
                          className="mt-1 border-primary data-[state=checked]:bg-primary"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className={`text-xs ${typeConfig[task.type].color}`}>
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {typeConfig[task.type].label}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              {task.duration} min
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-1 items-center">
                          <PomodoroButton
                            task={{
                              id: task.id,
                              title: task.title,
                              duration: task.duration,
                            }}
                            onComplete={toggleComplete}
                            variant="button"
                            className="text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => convertToBlock(task.title, task.duration)}
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground font-mono">
                  COMPLETADAS ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay tareas completadas
                  </p>
                ) : (
                  completedTasks.slice(0, 10).map((task) => {
                    const TypeIcon = typeConfig[task.type].icon;
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border opacity-60"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => toggleComplete(task.id)}
                          className="mt-1 border-primary data-[state=checked]:bg-primary"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-muted-foreground line-through">{task.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {typeConfig[task.type].label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      
      <JarvisVoiceButton />
    </div>
  );
};

export default Tasks;
