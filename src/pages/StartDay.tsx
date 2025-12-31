import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { useNutrition } from "@/hooks/useNutrition";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Sunrise,
  Clock,
  CheckSquare,
  Plus,
  Battery,
  Heart,
  Target,
  ListChecks,
  Brain,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Briefcase,
  Dumbbell,
  Languages,
  Flower2,
  Baby,
  AlertTriangle,
  Zap,
  FileText,
  MessageSquare,
  Utensils
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface OptionalActivity {
  id: string;
  label: string;
  icon: React.ElementType;
  duration: number;
  selected: boolean;
}

const STEPS = [
  { id: 1, title: "Bienvenida", icon: Sunrise },
  { id: 2, title: "Tareas", icon: CheckSquare },
  { id: 3, title: "Check-in", icon: Heart },
  { id: 4, title: "Plan del día", icon: ListChecks },
  { id: 5, title: "Nutrición", icon: Utensils },
  { id: 6, title: "JARVIS", icon: Brain },
];

const StartDay = () => {
  const navigate = useNavigate();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { pendingTasks, addTask, loading: tasksLoading } = useTasks();
  const { events: calendarEvents } = useGoogleCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { preferences: nutritionPrefs, generateMeals } = useNutrition();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [startTime] = useState(new Date());
  
  // Step 2: Tasks
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Step 3: Check-in
  const [checkIn, setCheckIn] = useState({
    energy: 3,
    mood: 3,
    focus: 3,
    availableTime: 8,
    interruptionRisk: "low" as "low" | "medium" | "high",
    dayMode: "balanced" as "balanced" | "push" | "survival",
  });

  // Step 4: Optional activities
  const [optionalActivities, setOptionalActivities] = useState<OptionalActivity[]>([
    { id: "coaching", label: "Sesión de coaching / crecimiento personal", icon: Brain, duration: 45, selected: false },
    { id: "english", label: "Clase de inglés", icon: Languages, duration: 30, selected: false },
    { id: "ai-training", label: "Formación de IA", icon: Sparkles, duration: 60, selected: false },
    { id: "meditation", label: "Meditación", icon: Flower2, duration: 15, selected: false },
    { id: "bosco", label: "Actividades tarde con Bosco", icon: Baby, duration: 120, selected: false },
    { id: "exercise", label: "Ejercicio físico", icon: Dumbbell, duration: 60, selected: false },
  ]);

  // Step: Whoops summary and observations
  const [whoopsSummary, setWhoopsSummary] = useState("");
  const [observations, setObservations] = useState("");

  // Step 5: Nutrition
  const [selectedLunch, setSelectedLunch] = useState<string | null>(null);
  const [selectedDinner, setSelectedDinner] = useState<string | null>(null);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [lunchOptions, setLunchOptions] = useState<Array<{name: string; description: string; calories: number; prep_time: string}>>([]);
  const [dinnerOptions, setDinnerOptions] = useState<Array<{name: string; description: string; calories: number; prep_time: string}>>([]);

  // Initialize selected tasks from pending
  useEffect(() => {
    if (pendingTasks.length > 0 && selectedTasks.length === 0) {
      // Pre-select high priority tasks
      const highPriority = pendingTasks
        .filter(t => t.priority === "P0" || t.priority === "P1")
        .map(t => t.id);
      setSelectedTasks(highPriority);
    }
  }, [pendingTasks]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask({
      title: newTaskTitle,
      type: "work",
      priority: "P1",
      duration: 30,
    });
    setNewTaskTitle("");
    toast.success("Tarea añadida");
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleActivity = (activityId: string) => {
    setOptionalActivities(prev => 
      prev.map(a => a.id === activityId ? { ...a, selected: !a.selected } : a)
    );
  };

  const handleGeneratePlan = async () => {
    const selectedTasksData = pendingTasks
      .filter(t => selectedTasks.includes(t.id))
      .map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        duration: t.duration,
      }));

    // Add optional activities as pseudo-tasks
    const activitiesAsEvents = optionalActivities
      .filter(a => a.selected)
      .map(a => ({
        title: a.label,
        time: "flexible",
        duration: `${a.duration}`,
        type: "life",
      }));

    await generatePlan(
      checkIn,
      selectedTasksData,
      [...calendarEvents.map(e => ({
        title: e.title,
        time: e.time,
        duration: e.duration,
        type: e.type,
      })), ...activitiesAsEvents]
    );
  };

  // Load meals when entering step 5
  useEffect(() => {
    if (currentStep === 5 && lunchOptions.length === 0 && !mealsLoading) {
      loadMeals();
    }
  }, [currentStep]);

  const loadMeals = async () => {
    setMealsLoading(true);
    try {
      const meals = await generateMeals(
        { energy: checkIn.energy, mood: checkIn.mood },
        whoopsSummary
      );
      if (meals) {
        setLunchOptions(meals.lunch_options);
        setDinnerOptions(meals.dinner_options);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setMealsLoading(false);
    }
  };

  // Save observations to database
  const saveObservations = async () => {
    if (!user) return;
    try {
      await supabase
        .from('daily_observations')
        .upsert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          whoops_summary: whoopsSummary || null,
          observations: observations || null,
          selected_lunch: selectedLunch || null,
          selected_dinner: selectedDinner || null,
        }, { onConflict: 'user_id,date' });
    } catch (error) {
      console.error('Error saving observations:', error);
    }
  };

  const nextStep = () => {
    if (currentStep === 5) {
      handleGeneratePlan();
      saveObservations();
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finishSetup = () => {
    // If there are time blocks, navigate to validation page
    if (plan && plan.timeBlocks && plan.timeBlocks.length > 0) {
      navigate("/validate-agenda", { state: { plan } });
    } else {
      toast.success("¡Día configurado correctamente!");
      navigate("/dashboard");
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const riskColors = {
    low: "bg-success/20 text-success border-success/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    high: "bg-destructive/20 text-destructive border-destructive/30",
  };

  const modeColors = {
    balanced: "bg-primary/20 text-primary border-primary/30",
    push: "bg-success/20 text-success border-success/30",
    survival: "bg-warning/20 text-warning border-warning/30",
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
        
        <main className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
          {/* Progress Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sunrise className="w-6 h-6 text-warning" />
                Inicio del Día
              </h1>
              <div className="text-sm text-muted-foreground font-mono">
                {format(startTime, "EEEE, d 'de' MMMM", { locale: es })}
              </div>
            </div>
            
            {/* Step Indicators */}
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      isActive && "bg-primary border-primary text-primary-foreground",
                      isCompleted && "bg-success border-success text-success-foreground",
                      !isActive && !isCompleted && "border-border text-muted-foreground"
                    )}>
                      <StepIcon className="w-5 h-5" />
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-2",
                        isCompleted ? "bg-success" : "bg-border"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="h-1" />
          </div>

          {/* Step Content */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const StepIcon = STEPS[currentStep - 1].icon;
                  return <StepIcon className="w-5 h-5 text-primary" />;
                })()}
                {STEPS[currentStep - 1].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Step 1: Welcome */}
              {currentStep === 1 && (
                <div className="text-center py-8 space-y-6">
                  <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center mx-auto">
                    <Sunrise className="w-10 h-10 text-warning" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">¡Buenos días!</h2>
                    <p className="text-muted-foreground mt-2">
                      Vamos a configurar tu día de forma óptima.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-mono">{format(startTime, "HH:mm")}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                      <CheckSquare className="w-4 h-4 text-primary" />
                      <span>{pendingTasks.length} tareas pendientes</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Tasks */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Revisa tus tareas pendientes y añade nuevas si es necesario.
                  </p>
                  
                  {/* Add new task */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nueva tarea..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      className="flex-1"
                    />
                    <Button onClick={handleAddTask} size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Task list */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {tasksLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : pendingTasks.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No hay tareas pendientes
                      </p>
                    ) : (
                      pendingTasks.map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                            selectedTasks.includes(task.id)
                              ? "border-primary/50 bg-primary/5"
                              : "border-border hover:border-primary/30"
                          )}
                          onClick={() => toggleTaskSelection(task.id)}
                        >
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {task.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {task.duration} min
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedTasks.length} tareas seleccionadas para hoy
                  </p>
                </div>
              )}

              {/* Step 3: Check-in */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    ¿Cómo te encuentras hoy?
                  </p>

                  <div className="grid gap-6">
                    {/* Energy */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Battery className="w-4 h-4 text-success" />
                          <span className="font-medium">Energía</span>
                        </div>
                        <span className="font-bold font-mono text-primary">{checkIn.energy}/5</span>
                      </div>
                      <Slider
                        value={[checkIn.energy]}
                        onValueChange={([value]) => setCheckIn(prev => ({ ...prev, energy: value }))}
                        min={1}
                        max={5}
                        step={1}
                      />
                    </div>

                    {/* Mood */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-destructive" />
                          <span className="font-medium">Ánimo</span>
                        </div>
                        <span className="font-bold font-mono text-primary">{checkIn.mood}/5</span>
                      </div>
                      <Slider
                        value={[checkIn.mood]}
                        onValueChange={([value]) => setCheckIn(prev => ({ ...prev, mood: value }))}
                        min={1}
                        max={5}
                        step={1}
                      />
                    </div>

                    {/* Focus */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <span className="font-medium">Foco</span>
                        </div>
                        <span className="font-bold font-mono text-primary">{checkIn.focus}/5</span>
                      </div>
                      <Slider
                        value={[checkIn.focus]}
                        onValueChange={([value]) => setCheckIn(prev => ({ ...prev, focus: value }))}
                        min={1}
                        max={5}
                        step={1}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      {/* Available Time */}
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Horas disponibles
                        </label>
                        <Input
                          type="number"
                          value={checkIn.availableTime}
                          onChange={(e) => setCheckIn(prev => ({ ...prev, availableTime: Number(e.target.value) }))}
                          min={0}
                          max={24}
                          className="font-mono"
                        />
                      </div>

                      {/* Interruption Risk */}
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Riesgo interrupción
                        </label>
                        <div className="flex gap-1">
                          {(["low", "medium", "high"] as const).map((risk) => (
                            <button
                              key={risk}
                              onClick={() => setCheckIn(prev => ({ ...prev, interruptionRisk: risk }))}
                              className={cn(
                                "flex-1 px-2 py-2 text-xs rounded-md border transition-all",
                                checkIn.interruptionRisk === risk
                                  ? riskColors[risk]
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              {risk === "low" ? "Bajo" : risk === "medium" ? "Medio" : "Alto"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Day Mode */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Modo del día
                      </label>
                      <div className="flex gap-2">
                        {(["balanced", "push", "survival"] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setCheckIn(prev => ({ ...prev, dayMode: mode }))}
                            className={cn(
                              "flex-1 px-3 py-2 text-sm rounded-md border transition-all",
                              checkIn.dayMode === mode
                                ? modeColors[mode]
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {mode === "balanced" ? "Balanceado" : mode === "push" ? "Empuje" : "Supervivencia"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Daily Plan Selection */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Selecciona las actividades opcionales para hoy.
                  </p>

                  <div className="space-y-3">
                    {optionalActivities.map(activity => {
                      const ActivityIcon = activity.icon;
                      return (
                        <div
                          key={activity.id}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                            activity.selected
                              ? "border-primary/50 bg-primary/5"
                              : "border-border hover:border-primary/30"
                          )}
                          onClick={() => toggleActivity(activity.id)}
                        >
                          <Checkbox
                            checked={activity.selected}
                            onCheckedChange={() => toggleActivity(activity.id)}
                          />
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            activity.selected ? "bg-primary/20" : "bg-muted"
                          )}>
                            <ActivityIcon className={cn(
                              "w-5 h-5",
                              activity.selected ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{activity.label}</p>
                            <p className="text-xs text-muted-foreground">{activity.duration} min</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Whoops Summary */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Resumen de Whoops
                    </label>
                    <Textarea
                      placeholder="Pega aquí tu resumen de Whoops..."
                      value={whoopsSummary}
                      onChange={(e) => setWhoopsSummary(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Observations */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Observaciones
                    </label>
                    <Textarea
                      placeholder="¿Algo más que quieras comentar sobre hoy?"
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      Resumen del día
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• {selectedTasks.length} tareas seleccionadas</li>
                      <li>• {optionalActivities.filter(a => a.selected).length} actividades opcionales</li>
                      <li>• {checkIn.availableTime}h disponibles</li>
                      <li>• Modo: {checkIn.dayMode === "balanced" ? "Balanceado" : checkIn.dayMode === "push" ? "Empuje" : "Supervivencia"}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 5: Nutrition */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Jarvis Nutrición te propone estas opciones para hoy.
                  </p>

                  {mealsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">Generando opciones personalizadas...</p>
                    </div>
                  ) : (
                    <>
                      {/* Lunch Selection */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Utensils className="w-4 h-4 text-warning" />
                          Comida
                        </h4>
                        <div className="grid gap-2">
                          {lunchOptions.map((option, index) => (
                            <div
                              key={index}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                selectedLunch === option.name
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              )}
                              onClick={() => setSelectedLunch(option.name)}
                            >
                              <Checkbox
                                checked={selectedLunch === option.name}
                                onCheckedChange={() => setSelectedLunch(option.name)}
                              />
                              <div className="flex-1">
                                <span className="font-medium">{option.name}</span>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p className="font-mono">{option.calories} kcal</p>
                                <p>{option.prep_time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dinner Selection */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Utensils className="w-4 h-4 text-primary" />
                          Cena
                        </h4>
                        <div className="grid gap-2">
                          {dinnerOptions.map((option, index) => (
                            <div
                              key={index}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                selectedDinner === option.name
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              )}
                              onClick={() => setSelectedDinner(option.name)}
                            >
                              <Checkbox
                                checked={selectedDinner === option.name}
                                onCheckedChange={() => setSelectedDinner(option.name)}
                              />
                              <div className="flex-1">
                                <span className="font-medium">{option.name}</span>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p className="font-mono">{option.calories} kcal</p>
                                <p>{option.prep_time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button 
                        variant="outline" 
                        onClick={loadMeals}
                        disabled={mealsLoading}
                        className="w-full gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Regenerar opciones
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Step 6: JARVIS Plan */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  {planLoading ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-pulse">
                        <Brain className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-muted-foreground">JARVIS está organizando tu día...</p>
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </div>
                  ) : plan ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5 text-success" />
                          <span className="font-medium text-success">Plan generado</span>
                        </div>
                        <p className="text-foreground">{plan.greeting}</p>
                      </div>

                      {plan.nextSteps && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <h4 className="font-medium mb-2">Próximo paso</h4>
                          <p className="text-sm text-muted-foreground">{plan.nextSteps.immediate}</p>
                        </div>
                      )}

                      {plan.tips && plan.tips.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Consejos del día</h4>
                          <ul className="space-y-1">
                            {plan.tips.slice(0, 3).map((tip, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No se pudo generar el plan</p>
                      <Button variant="outline" onClick={handleGeneratePlan} className="mt-4">
                        Reintentar
                      </Button>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>

            {currentStep < 6 ? (
              <Button onClick={nextStep} className="gap-2">
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={finishSetup} 
                className="gap-2"
                disabled={planLoading || !plan}
              >
                <Sparkles className="w-4 h-4" />
                Comenzar el día
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default StartDay;
