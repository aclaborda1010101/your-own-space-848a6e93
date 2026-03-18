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

const TASK_WORKSPACE_STORAGE_KEY = "jarvis-task-workspace-v1";

const Tasks = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"work" | "life" | "finance">("work");
  const [newTaskPersonal, setNewTaskPersonal] = useState(false);
  const [view, setView] = useState<"today" | "week">("today");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskWorkspaces, setTaskWorkspaces] = useState<Record<string, TaskWorkspaceRecord>>({});

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

  return (
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
              <ShareDialog resourceType="task" resourceName="Todas las tareas" />
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

                  <div className="flex items-center gap-2 ml-1">
                    <Switch
                      checked={newTaskPersonal}
                      onCheckedChange={setNewTaskPersonal}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Lock className={`w-3.5 h-3.5 ${newTaskPersonal ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground hidden sm:inline">Personal</span>
                  </div>
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

          {/* Task Workspace */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
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
        </main>
  );
};

export default Tasks;
