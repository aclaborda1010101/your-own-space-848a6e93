import { useState } from "react";
import { format } from "date-fns";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PomodoroButton } from "@/components/pomodoro/PomodoroButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SwipeableTask } from "@/components/tasks/SwipeableTask";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  CheckSquare, 
  Briefcase, 
  Heart, 
  Wallet,
  Clock,
  Calendar,
  CalendarIcon,
  Loader2,
} from "lucide-react";

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/10 text-primary border-primary/20" },
  life: { icon: Heart, label: "Vida", color: "bg-success/10 text-success border-success/20" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/10 text-warning border-warning/20" },
};

const priorityColors: Record<string, string> = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
  P3: "bg-secondary/50 text-secondary-foreground border-border/50",
};

const Tasks = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"work" | "life" | "finance">("work");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [view, setView] = useState<"today" | "week">("today");

  const { 
    pendingTasks, 
    completedTasks, 
    loading, 
    addTask, 
    toggleComplete, 
    deleteTask 
  } = useTasks();

  const { createEvent, connected: calendarConnected } = useCalendar();

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask({
      title: newTaskTitle,
      type: newTaskType,
      priority: "P1",
      duration: 30,
      dueDate: newTaskDueDate || null,
    });
    setNewTaskTitle("");
    setNewTaskDueDate(undefined);
  };

  const convertToBlock = async (taskTitle: string, duration: number) => {
    if (!calendarConnected) return;
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
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-xs tracking-wider">CARGANDO TAREAS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 space-y-4 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground font-display">Tareas</h1>
            <p className="text-xs text-muted-foreground font-mono">{pendingTasks.length} pendientes</p>
          </div>
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            variant={view === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("today")}
            className={`h-8 text-xs rounded-lg ${view === "today" ? "bg-primary text-primary-foreground" : "border-border"}`}
          >
            Hoy
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            className={`h-8 text-xs rounded-lg ${view === "week" ? "bg-primary text-primary-foreground" : "border-border"}`}
          >
            Semana
          </Button>
        </div>
      </div>

      {/* Add Task */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Nueva tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              className="flex-1 h-10 bg-background/50 border-border/50 font-mono text-sm rounded-xl"
            />
            
            <div className="flex gap-1.5 flex-wrap">
              {(["work", "life", "finance"] as const).map((type) => {
                const config = typeConfig[type];
                return (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTaskType(type)}
                    className={`h-10 w-10 p-0 rounded-xl ${newTaskType === type ? config.color : "border-border/50 text-muted-foreground"}`}
                  >
                    <config.icon className="w-4 h-4" />
                  </Button>
                );
              })}

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-10 rounded-xl gap-1.5 text-xs",
                      newTaskDueDate ? "border-primary/30 text-primary" : "border-border/50 text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {newTaskDueDate ? format(newTaskDueDate, "dd/MM") : "Fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={newTaskDueDate}
                    onSelect={setNewTaskDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <Button 
                onClick={handleAddTask}
                className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Añadir</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        {/* Pending */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground font-mono tracking-wider">
              PENDIENTES ({pendingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay tareas pendientes
              </p>
            ) : (
              pendingTasks.map((task) => (
                <SwipeableTask
                  key={task.id}
                  task={task}
                  onToggleComplete={toggleComplete}
                  onDelete={deleteTask}
                  onConvertToBlock={convertToBlock}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground font-mono tracking-wider">
              COMPLETADAS ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay tareas completadas
              </p>
            ) : (
              completedTasks.slice(0, 10).map((task) => {
                const TypeIcon = typeConfig[task.type].icon;
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl border border-border/30 opacity-50"
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => toggleComplete(task.id)}
                      className="mt-0.5 border-primary data-[state=checked]:bg-primary"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground line-through truncate">{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground">
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
    </div>
  );
};

export default Tasks;
