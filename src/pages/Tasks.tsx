import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { SuggestedTasksDialog, useTaskSuggestionsCount } from "@/components/tasks/SuggestedTasksDialog";
import {
  buildDefaultWorkspace,
  TaskWorkspaceDetail,
  type TaskWorkspaceRecord,
} from "@/components/tasks/TaskWorkspaceDetail";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SwipeableTask } from "@/components/tasks/SwipeableTask";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { 
  Plus, 
  CheckSquare, 
  Briefcase, 
  Heart, 
  Wallet,
  Loader2,
  Lock,
  Sparkles,
  Flame,
  CalendarCheck,
  ChevronDown,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { cn } from "@/lib/utils";

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

const TASK_WORKSPACE_STORAGE_KEY = "jarvis-task-workspace-v1";

const Tasks = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"work" | "life" | "finance">("work");
  const [newTaskPersonal, setNewTaskPersonal] = useState(false);
  const [view, setView] = useState<"today" | "week">("today");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskWorkspaces, setTaskWorkspaces] = useState<Record<string, TaskWorkspaceRecord>>({});
  const [completedOpen, setCompletedOpen] = useState(false);

  const { 
    pendingTasks, 
    completedTasks, 
    loading, 
    addTask, 
    toggleComplete, 
    deleteTask,
    updateTask,
  } = useTasks();

  const { createEvent, connected: calendarConnected } = useCalendar();
  const suggestionsCount = useTaskSuggestionsCount();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(TASK_WORKSPACE_STORAGE_KEY);
      if (!stored) return;
      setTaskWorkspaces(JSON.parse(stored));
    } catch (error) {
      console.error("Error loading task workspace:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TASK_WORKSPACE_STORAGE_KEY, JSON.stringify(taskWorkspaces));
  }, [taskWorkspaces]);

  const allTasks = useMemo(() => [...pendingTasks, ...completedTasks], [pendingTasks, completedTasks]);

  useEffect(() => {
    if (!allTasks.length) {
      setSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !allTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(allTasks[0].id);
    }
  }, [allTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => allTasks.find((task) => task.id === selectedTaskId) ?? null,
    [allTasks, selectedTaskId]
  );

  const selectedWorkspace = selectedTask ? taskWorkspaces[selectedTask.id] ?? null : null;

  const handleSaveWorkspace = (taskId: string, workspace: Omit<TaskWorkspaceRecord, "taskId">) => {
    setTaskWorkspaces((current) => ({
      ...current,
      [taskId]: {
        taskId,
        ...workspace,
      },
    }));
  };

  const handleSelectTask = (task: any) => {
    setSelectedTaskId(task.id);
    setTaskWorkspaces((current) => {
      if (current[task.id]) return current;
      return {
        ...current,
        [task.id]: buildDefaultWorkspace(task),
      };
    });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    await addTask({
      title: newTaskTitle,
      type: newTaskType,
      priority: "P1",
      duration: 30,
      isPersonal: newTaskPersonal,
    });

    setNewTaskTitle("");
    setNewTaskPersonal(false);
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

  const p0Count = pendingTasks.filter((t: any) => t.priority === "P0").length;
  const completedToday = completedTasks.filter((t: any) => {
    if (!t.completed_at) return false;
    const d = new Date(t.completed_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
        <main className="p-4 lg:p-6 space-y-6">
          <Breadcrumbs />

          <PageHero
            eyebrow="Foco del día"
            eyebrowIcon={<Sparkles className="w-3 h-3" />}
            title={
              <>
                Tus <span className="italic font-serif text-primary">tareas</span>
              </>
            }
            subtitle="Prioriza, ejecuta y convierte tareas en bloques de calendario sin fricción."
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuggestionsOpen(true)}
                  className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5 rounded-full"
                >
                  <Sparkles className="w-4 h-4" />
                  Sugeridas
                  {suggestionsCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-primary text-primary-foreground">
                      {suggestionsCount}
                    </Badge>
                  )}
                </Button>
                <ShareDialog resourceType="task" resourceName="Todas las tareas" />
                <div className="flex items-center gap-1 p-1 rounded-full bg-card/40 backdrop-blur-xl border border-border/60">
                  <Button
                    size="sm"
                    variant={view === "today" ? "default" : "ghost"}
                    onClick={() => setView("today")}
                    className="rounded-full h-8"
                  >
                    Hoy
                  </Button>
                  <Button
                    size="sm"
                    variant={view === "week" ? "default" : "ghost"}
                    onClick={() => setView("week")}
                    className="rounded-full h-8"
                  >
                    Semana
                  </Button>
                </div>
              </>
            }
            stats={[
              { label: "Pendientes", value: pendingTasks.length, icon: <CheckSquare className="w-4 h-4" />, tone: "primary" },
              { label: "Críticas P0", value: p0Count, hint: "máxima prioridad", icon: <Flame className="w-4 h-4" />, tone: "destructive" },
              { label: "Hechas hoy", value: completedToday, icon: <CalendarCheck className="w-4 h-4" />, tone: "success" },
              { label: "Sugeridas IA", value: suggestionsCount, hint: "por revisar", icon: <Sparkles className="w-4 h-4" />, tone: "accent" },
            ]}
          />

          {/* Add Task */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6 space-y-3">
              <Input
                placeholder="Nueva tarea..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                className="w-full h-11 bg-background border-border font-mono"
              />

              {/* Selector inline tipo: pills full-width */}
              <div className="grid grid-cols-3 gap-2">
                {(["work", "life", "finance"] as const).map((type) => {
                  const config = typeConfig[type];
                  const active = newTaskType === type;
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant="outline"
                      onClick={() => setNewTaskType(type)}
                      className={cn(
                        "h-11 w-full gap-2 text-xs sm:text-sm",
                        active
                          ? config.color
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <config.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{config.label}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newTaskPersonal}
                    onCheckedChange={setNewTaskPersonal}
                    className="data-[state=checked]:bg-primary"
                  />
                  <Lock className={`w-3.5 h-3.5 ${newTaskPersonal ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">Personal · Privado</span>
                </div>
              </div>

              <Button
                onClick={handleAddTask}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir tarea
              </Button>
            </CardContent>
          </Card>

          {/* Task Workspace */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)] min-w-0">
            <div className="space-y-6 min-w-0">
              {/* Pending - full width */}
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
                    pendingTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleSelectTask(task)}
                        className="block w-full rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {task.projectName && (
                            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                              [{task.projectName}]
                            </Badge>
                          )}
                          {task.isPersonal && (
                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                              <Lock className="w-3 h-3 mr-1" /> Personal
                            </Badge>
                          )}
                        </div>
                        <div className={selectedTaskId === task.id ? "rounded-xl ring-2 ring-primary/40" : "rounded-xl"}>
                          <SwipeableTask
                            task={task}
                            onToggleComplete={toggleComplete}
                            onDelete={deleteTask}
                            onConvertToBlock={convertToBlock}
                            onEdit={(t) => setEditingTask(t)}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Completed - collapsible accordion */}
              <Card className="border-border bg-card">
                <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors rounded-t-lg"
                    >
                      <CardTitle className="text-lg font-semibold text-foreground font-mono">
                        COMPLETADAS ({completedTasks.length})
                      </CardTitle>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform duration-200",
                          completedOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      {completedTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No hay tareas completadas
                        </p>
                      ) : (
                        completedTasks.slice(0, 10).map((task) => {
                          const TypeIcon = typeConfig[task.type].icon;
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => handleSelectTask(task)}
                              className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                            </button>
                          );
                        })
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>

            <TaskWorkspaceDetail
              task={selectedTask}
              workspace={selectedWorkspace}
              onSave={handleSaveWorkspace}
            />
          </div>

          <EditTaskDialog
            task={editingTask}
            open={!!editingTask}
            onOpenChange={(open) => !open && setEditingTask(null)}
            onSave={updateTask}
          />

          <SuggestedTasksDialog
            open={suggestionsOpen}
            onOpenChange={setSuggestionsOpen}
          />
        </main>
  );
};

export default Tasks;
