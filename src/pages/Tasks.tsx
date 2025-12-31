import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  CheckSquare, 
  Briefcase, 
  Heart, 
  Wallet,
  Clock,
  Calendar,
  Trash2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
  completed: boolean;
  createdAt: Date;
}

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

const initialTasks: Task[] = [
  { id: "1", title: "Entregar propuesta Cliente A", type: "work", priority: "P0", duration: 60, completed: false, createdAt: new Date() },
  { id: "2", title: "30 min ejercicio", type: "life", priority: "P0", duration: 30, completed: false, createdAt: new Date() },
  { id: "3", title: "Revisar emails urgentes", type: "work", priority: "P1", duration: 20, completed: false, createdAt: new Date() },
  { id: "4", title: "Revisar facturas pendientes", type: "finance", priority: "P1", duration: 15, completed: false, createdAt: new Date() },
  { id: "5", title: "Preparar reunión semanal", type: "work", priority: "P2", duration: 45, completed: true, createdAt: new Date() },
];

const Tasks = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"work" | "life" | "finance">("work");
  const [view, setView] = useState<"today" | "week">("today");

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      type: newTaskType,
      priority: "P1", // AI would suggest this
      duration: 30, // AI would estimate this
      completed: false,
      createdAt: new Date(),
    };

    setTasks([newTask, ...tasks]);
    setNewTaskTitle("");
    
    toast.success("Tarea creada", {
      description: "JARVIS ha estimado prioridad P1 y 30 min de duración.",
    });
  };

  const toggleComplete = (id: string) => {
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    );
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Tarea eliminada");
  };

  const convertToBlock = (task: Task) => {
    toast.success("Bloque creado en calendario", {
      description: `${task.title} - ${task.duration} min`,
    });
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tareas</h1>
                <p className="text-sm text-muted-foreground">{pendingTasks.length} pendientes</p>
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
                  className="flex-1 h-11 bg-background border-border"
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
                <CardTitle className="text-lg font-semibold text-foreground">
                  Pendientes ({pendingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingTasks.map((task) => {
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

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => convertToBlock(task)}
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Calendar className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTask(task.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Completadas ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedTasks.map((task) => {
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
                })}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Tasks;
