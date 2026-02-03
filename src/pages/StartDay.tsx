import { useState, useEffect, useCallback } from "react";
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
import { useCalendar } from "@/hooks/useCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { useNutrition } from "@/hooks/useNutrition";
import { useAuth } from "@/hooks/useAuth";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useNutritionProfile } from "@/hooks/useNutritionProfile";
import { useMealHistory } from "@/hooks/useMealHistory";
import { useShoppingList } from "@/hooks/useShoppingList";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useBosco } from "@/hooks/useBosco";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ModeSelector } from "@/components/dashboard/ModeSelector";
import { BoscoQuickCard } from "@/components/dashboard/BoscoQuickCard";
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
  Utensils,
  ChefHat,
  ShoppingCart,
  Check,
  Palmtree,
  Calendar
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RecipeDialog } from "@/components/nutrition/RecipeDialog";

interface OptionalActivity {
  id: string;
  label: string;
  icon: React.ElementType;
  duration: number;
  selected: boolean;
}

import { ValidateAgendaStep } from "@/components/startday/ValidateAgendaStep";

const STEPS = [
  { id: 1, title: "Bienvenida", icon: Sunrise },
  { id: 2, title: "Tareas", icon: CheckSquare },
  { id: 3, title: "Check-in", icon: Heart },
  { id: 4, title: "Plan del día", icon: ListChecks },
  { id: 5, title: "Bosco", icon: Baby },
  { id: 6, title: "Nutrición", icon: Utensils },
  { id: 7, title: "JARVIS", icon: Brain },
  { id: 8, title: "Validar", icon: Check },
];

const StartDay = () => {
  const navigate = useNavigate();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { pendingTasks, addTask, loading: tasksLoading } = useTasks();
  const { events: calendarEvents, loading: calendarLoading, connected: calendarConnected } = useCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { preferences: nutritionPrefs, generateMeals } = useNutrition();
  const { user } = useAuth();
  const { draftCheckIn, setCheckIn, registerCheckIn, isRegistered: checkInRegistered, saving: checkInSaving } = useCheckIn();
  const { profile: nutritionProfile } = useNutritionProfile();
  const { addMealToHistory } = useMealHistory();
  const { generateFromRecipes, generating: shoppingListGenerating } = useShoppingList();
  const { profile: userProfile } = useUserProfile();
  const { activities: boscoActivities, generateActivities: generateBoscoActivities, generatingActivities: boscoGenerating } = useBosco();

  // Check if system is in special mode
  const currentMode = userProfile?.current_mode || 'normal';

  const [currentStep, setCurrentStep] = useState(1);
  const [startTime] = useState(new Date());
  
  // Track which steps have been visited/filled
  const [stepsCompleted, setStepsCompleted] = useState<Set<number>>(new Set());
  const [boscoStepFilled, setBoscoStepFilled] = useState(false);
  
  // Step 2: Tasks
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [tasksStepFilled, setTasksStepFilled] = useState(false);

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
  const [planStepFilled, setPlanStepFilled] = useState(false);

  // Step 5: Nutrition
  const [selectedLunch, setSelectedLunch] = useState<string | null>(null);
  const [selectedDinner, setSelectedDinner] = useState<string | null>(null);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [lunchOptions, setLunchOptions] = useState<Array<{name: string; description: string; calories: number; prep_time: string}>>([]);
  const [dinnerOptions, setDinnerOptions] = useState<Array<{name: string; description: string; calories: number; prep_time: string}>>([]);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [selectedMealForRecipe, setSelectedMealForRecipe] = useState<{name: string; description: string; calories: number; prep_time: string} | null>(null);
  const [nutritionStepFilled, setNutritionStepFilled] = useState(false);

  // Initialize selected tasks from pending
  useEffect(() => {
    if (pendingTasks.length > 0 && selectedTasks.length === 0) {
      const highPriority = pendingTasks
        .filter(t => t.priority === "P0" || t.priority === "P1")
        .map(t => t.id);
      setSelectedTasks(highPriority);
    }
  }, [pendingTasks]);

  // Load existing daily observations
  useEffect(() => {
    if (user) {
      loadExistingData();
    }
  }, [user]);

  const loadExistingData = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data } = await supabase
        .from('daily_observations')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (data) {
        if (data.whoops_summary) setWhoopsSummary(data.whoops_summary);
        if (data.observations) setObservations(data.observations);
        if (data.selected_lunch) {
          setSelectedLunch(data.selected_lunch);
          setNutritionStepFilled(true);
        }
        if (data.selected_dinner) setSelectedDinner(data.selected_dinner);
        setPlanStepFilled(true);
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

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

  // Get stress level based on check-in and nutrition profile rules
  const getStressLevel = useCallback(() => {
    const energy = draftCheckIn.energy;
    const dayMode = draftCheckIn.dayMode;
    const interruptionRisk = draftCheckIn.interruptionRisk;
    
    // Apply IF/THEN rules from nutrition profile
    if (dayMode === "survival" || interruptionRisk === "high" || energy <= 2) {
      return "high";
    }
    if (energy <= 3 || interruptionRisk === "medium") {
      return "medium";
    }
    return "low";
  }, [draftCheckIn]);

  const handleGeneratePlan = async () => {
    // Calendar events are synced automatically via the useCalendar hook
    
    const selectedTasksData = pendingTasks
      .filter(t => selectedTasks.includes(t.id))
      .map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        duration: t.duration,
      }));

    // Add optional activities as pseudo-tasks - FIXED: use "descanso" not "buffer"
    const activitiesAsEvents = optionalActivities
      .filter(a => a.selected)
      .map(a => ({
        title: a.label,
        time: "flexible",
        duration: `${a.duration}`,
        type: "life",
      }));

    // Helper to calculate end time from start time and duration
    const calculateEventEndTime = (startTime: string, duration: string): string => {
      const [hours, minutes] = startTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return startTime;
      
      let durationMinutes = 0;
      const hourMatch = duration.match(/(\d+)\s*h/i);
      const minMatch = duration.match(/(\d+)\s*(?:min|m(?!in)|$)/i);
      
      if (hourMatch) durationMinutes += parseInt(hourMatch[1]) * 60;
      if (minMatch) durationMinutes += parseInt(minMatch[1]);
      if (!hourMatch && !minMatch) {
        const plainNum = parseInt(duration);
        if (!isNaN(plainNum)) durationMinutes = plainNum;
      }
      
      if (durationMinutes === 0) return startTime;
      
      const totalMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      
      return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    // Map calendar events with endTime and isFixed flag
    const mappedCalendarEvents = calendarEvents.map(e => ({
      title: e.title,
      time: e.time,
      endTime: calculateEventEndTime(e.time, e.duration),
      duration: e.duration,
      type: e.type,
      isFixed: true, // Calendar events are immovable
    }));

    // Pass current local time so the plan starts from now
    const currentTime = new Date().toTimeString().slice(0, 5); // "HH:MM" in local time
    
    await generatePlan(
      draftCheckIn,
      selectedTasksData,
      [...mappedCalendarEvents, ...activitiesAsEvents],
      currentTime
    );
  };

  // Load meals when entering step 6 with stress/energy rules integrated
  useEffect(() => {
    if (currentStep === 6 && lunchOptions.length === 0 && !mealsLoading && user) {
      console.log('Loading meals for step 6...');
      loadMeals();
    }
  }, [currentStep, user]);

  const loadMeals = async () => {
    setMealsLoading(true);
    try {
      const stressLevel = getStressLevel();
      const energy = draftCheckIn.energy;
      
      // Build context for meal generation based on IF/THEN rules
      let mealContext = whoopsSummary || '';
      
      // Apply IF/THEN rules from JARVIS Nutrición
      if (stressLevel === "high" || energy <= 2) {
        mealContext += '\n\nREGLA ACTIVA: Estrés alto o energía muy baja. Proponer solo platos simples, conocidos y repetibles. Máxima simplicidad.';
      } else if (stressLevel === "medium" || energy <= 3) {
        mealContext += '\n\nREGLA ACTIVA: Energía moderada. Proponer platos equilibrados y fáciles de preparar.';
      }
      
      // Apply diet rules from nutrition profile
      if (nutritionProfile?.active_diet === 'keto') {
        mealContext += '\n\nDIETA ACTIVA: Keto - eliminar pasta y arroz, priorizar carne, huevo, queso, atún.';
      }
      
      // Add rejected foods warning
      if (nutritionProfile?.rejected_foods && nutritionProfile.rejected_foods.length > 0) {
        mealContext += `\n\nALIMENTOS RECHAZADOS (NUNCA SUGERIR): ${nutritionProfile.rejected_foods.join(', ')}`;
      }
      
      // Add preferred foods
      if (nutritionProfile?.preferred_foods && nutritionProfile.preferred_foods.length > 0) {
        mealContext += `\n\nALIMENTOS PREFERIDOS: ${nutritionProfile.preferred_foods.join(', ')}`;
      }
      
      // Intermittent fasting rule
      if (nutritionProfile?.intermittent_fasting) {
        mealContext += '\n\nAYUNO INTERMITENTE ACTIVO: No sugerir desayuno.';
      }

      const meals = await generateMeals(
        { energy: draftCheckIn.energy, mood: draftCheckIn.mood },
        mealContext
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

  // Save meals to history and generate shopping list
  const saveMealsAndGenerateShoppingList = async () => {
    if (selectedLunch) {
      const lunchData = lunchOptions.find(o => o.name === selectedLunch);
      await addMealToHistory('lunch', selectedLunch, lunchData);
    }
    if (selectedDinner) {
      const dinnerData = dinnerOptions.find(o => o.name === selectedDinner);
      await addMealToHistory('dinner', selectedDinner, dinnerData);
    }

    // Generate shopping list from selected meals
    const recipesToAdd = [];
    if (selectedLunch) {
      recipesToAdd.push({ name: selectedLunch });
    }
    if (selectedDinner) {
      recipesToAdd.push({ name: selectedDinner });
    }
    
    if (recipesToAdd.length > 0) {
      try {
        await generateFromRecipes(recipesToAdd);
      } catch (error) {
        console.error('Error generating shopping list:', error);
      }
    }
  };

  // Save check-in when leaving step 3
  const saveCheckIn = async () => {
    await registerCheckIn();
  };

  // Handle step navigation with auto-save
  const goToStep = async (stepId: number) => {
    // Save current step data before navigating
    if (currentStep === 3) {
      await saveCheckIn();
    } else if (currentStep === 4) {
      await saveObservations();
      setPlanStepFilled(true);
    } else if (currentStep === 5) {
      await saveObservations();
      await saveMealsAndGenerateShoppingList();
      setNutritionStepFilled(true);
    } else if (currentStep === 2) {
      setTasksStepFilled(true);
    }

    setStepsCompleted(prev => new Set([...prev, currentStep]));
    setCurrentStep(stepId);
  };

  const nextStep = async () => {
    if (currentStep === 3) {
      await saveCheckIn();
    } else if (currentStep === 4) {
      await saveObservations();
      setPlanStepFilled(true);
    } else if (currentStep === 5) {
      // Bosco step - generate activities if none exist
      if (boscoActivities.length === 0) {
        await generateBoscoActivities('all');
      }
      setBoscoStepFilled(true);
    } else if (currentStep === 6) {
      handleGeneratePlan();
      await saveObservations();
      await saveMealsAndGenerateShoppingList();
      setNutritionStepFilled(true);
    } else if (currentStep === 2) {
      setTasksStepFilled(true);
    }
    
    setStepsCompleted(prev => new Set([...prev, currentStep]));
    
    if (currentStep < 7) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finishSetup = () => {
    if (plan && plan.timeBlocks && plan.timeBlocks.length > 0) {
      // Move to validate step instead of navigating away
      setCurrentStep(8);
    } else {
      toast.success("¡Día configurado correctamente!");
      navigate("/dashboard");
    }
  };

  const handleAgendaComplete = () => {
    setStepsCompleted(prev => new Set([...prev, 8]));
  };

  // Determine if current step is already filled
  const isCurrentStepFilled = () => {
    switch (currentStep) {
      case 2: return tasksStepFilled || selectedTasks.length > 0;
      case 3: return checkInRegistered;
      case 4: return planStepFilled;
      case 5: return boscoStepFilled || boscoActivities.length > 0;
      case 6: return nutritionStepFilled || (selectedLunch !== null && selectedDinner !== null);
      default: return false;
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
            
            {/* Step Indicators - CLICKABLE */}
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = stepsCompleted.has(step.id) || currentStep > step.id;
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      onClick={() => goToStep(step.id)}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all cursor-pointer hover:scale-105",
                        isActive && "bg-primary border-primary text-primary-foreground",
                        isCompleted && !isActive && "bg-success border-success text-success-foreground",
                        !isActive && !isCompleted && "border-border text-muted-foreground hover:border-primary/50"
                      )}
                      title={step.title}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </button>
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
                    <h2 className="text-2xl font-bold text-foreground">
                      ¡Buenos días{userProfile?.name ? `, ${userProfile.name}` : ''}!
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      Vamos a configurar tu día de forma óptima.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-mono">{format(startTime, "HH:mm")}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                      <CheckSquare className="w-4 h-4 text-primary" />
                      <span>{pendingTasks.length} tareas pendientes</span>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">Modo del sistema</p>
                    <div className="flex justify-center">
                      <ModeSelector compact />
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
                    {checkInRegistered && (
                      <Badge variant="secondary" className="ml-2">Guardado</Badge>
                    )}
                  </p>

                  <div className="grid gap-6">
                    {/* Energy */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Battery className="w-4 h-4 text-success" />
                          <span className="font-medium">Energía</span>
                        </div>
                        <span className="font-bold font-mono text-primary">{draftCheckIn.energy}/5</span>
                      </div>
                      <Slider
                        value={[draftCheckIn.energy]}
                        onValueChange={([value]) => setCheckIn({ ...draftCheckIn, energy: value })}
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
                        <span className="font-bold font-mono text-primary">{draftCheckIn.mood}/5</span>
                      </div>
                      <Slider
                        value={[draftCheckIn.mood]}
                        onValueChange={([value]) => setCheckIn({ ...draftCheckIn, mood: value })}
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
                        <span className="font-bold font-mono text-primary">{draftCheckIn.focus}/5</span>
                      </div>
                      <Slider
                        value={[draftCheckIn.focus]}
                        onValueChange={([value]) => setCheckIn({ ...draftCheckIn, focus: value })}
                        min={1}
                        max={5}
                        step={1}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Horas disponibles
                        </label>
                        <Input
                          type="number"
                          value={draftCheckIn.availableTime}
                          onChange={(e) => setCheckIn({ ...draftCheckIn, availableTime: Number(e.target.value) })}
                          min={0}
                          max={24}
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Riesgo interrupción
                        </label>
                        <div className="flex gap-1">
                          {(["low", "medium", "high"] as const).map((risk) => (
                            <button
                              key={risk}
                              onClick={() => setCheckIn({ ...draftCheckIn, interruptionRisk: risk })}
                              className={cn(
                                "flex-1 px-2 py-2 text-xs rounded-md border transition-all",
                                draftCheckIn.interruptionRisk === risk
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

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Modo del día
                      </label>
                      <div className="flex gap-2">
                        {(["balanced", "push", "survival"] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setCheckIn({ ...draftCheckIn, dayMode: mode })}
                            className={cn(
                              "flex-1 px-3 py-2 text-sm rounded-md border transition-all",
                              draftCheckIn.dayMode === mode
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Resumen de Whoop
                    </label>
                    <Textarea
                      placeholder="Pega aquí tu resumen de Whoop..."
                      value={whoopsSummary}
                      onChange={(e) => setWhoopsSummary(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

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
                      <li>• {draftCheckIn.availableTime}h disponibles</li>
                      <li>• Modo: {draftCheckIn.dayMode === "balanced" ? "Balanceado" : draftCheckIn.dayMode === "push" ? "Empuje" : "Supervivencia"}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 5: Bosco */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Actividades sugeridas para hoy con Bosco.
                  </p>

                  {/* Mode warning for vacation/crisis */}
                  {currentMode === 'vacation' && (
                    <div className="p-3 rounded-lg border bg-warning/10 border-warning/30 text-warning flex items-center gap-2">
                      <Palmtree className="w-4 h-4" />
                      <span className="text-sm">Modo vacaciones: actividades flexibles, sin presión</span>
                    </div>
                  )}
                  {currentMode === 'crisis' && (
                    <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Modo crisis: solo vínculo básico, sin actividades educativas</span>
                    </div>
                  )}

                  <BoscoQuickCard />

                  {boscoActivities.length > 0 && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Baby className="w-4 h-4 text-pink-500" />
                        Resumen Bosco
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• {boscoActivities.filter(a => !a.completed).length} actividades pendientes</li>
                        <li>• {boscoActivities.filter(a => a.completed).length} completadas</li>
                        <li>• Tiempo estimado: {boscoActivities.filter(a => !a.completed).reduce((acc, a) => acc + a.duration_minutes, 0)} min</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Nutrition */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Jarvis Nutrición te propone estas opciones para hoy.
                    </p>
                    {shoppingListGenerating && (
                      <Badge variant="secondary" className="gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        Generando lista...
                      </Badge>
                    )}
                  </div>

                  {/* Crisis mode: simplified nutrition */}
                  {currentMode === 'crisis' && (
                    <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Modo crisis: nutrición ultrabásica, platos conocidos sin decisiones</span>
                    </div>
                  )}

                  {/* Stress/Energy indicator */}
                  {getStressLevel() !== "low" && currentMode === 'normal' && (
                    <div className={cn(
                      "p-3 rounded-lg border flex items-center gap-2",
                      getStressLevel() === "high" 
                        ? "bg-destructive/10 border-destructive/30 text-destructive" 
                        : "bg-warning/10 border-warning/30 text-warning"
                    )}>
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">
                        {getStressLevel() === "high" 
                          ? "Modo simplificado: platos fáciles y conocidos"
                          : "Energía moderada: platos equilibrados"}
                      </span>
                    </div>
                  )}

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
                                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group",
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
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMealForRecipe(option);
                                    setRecipeDialogOpen(true);
                                  }}
                                >
                                  <ChefHat className="w-4 h-4 mr-1" />
                                  Receta
                                </Button>
                                <div className="text-right text-xs text-muted-foreground">
                                  <p className="font-mono">{option.calories} kcal</p>
                                  <p>{option.prep_time}</p>
                                </div>
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
                                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group",
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
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMealForRecipe(option);
                                    setRecipeDialogOpen(true);
                                  }}
                                >
                                  <ChefHat className="w-4 h-4 mr-1" />
                                  Receta
                                </Button>
                                <div className="text-right text-xs text-muted-foreground">
                                  <p className="font-mono">{option.calories} kcal</p>
                                  <p>{option.prep_time}</p>
                                </div>
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

              {/* Step 7: JARVIS Plan */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  {/* Calendar Status Indicator */}
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border text-sm",
                    !calendarConnected 
                      ? "bg-warning/10 border-warning/30 text-warning"
                      : calendarLoading 
                        ? "bg-muted border-border text-muted-foreground"
                        : calendarEvents.length > 0
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-muted border-border text-muted-foreground"
                  )}>
                    <Calendar className="w-4 h-4" />
                    {!calendarConnected ? (
                      <span>Calendario no conectado - el plan podría tener conflictos</span>
                    ) : calendarLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sincronizando calendario...</span>
                      </>
                    ) : (
                      <span>{calendarEvents.length} eventos sincronizados del calendario</span>
                    )}
                  </div>
                  
                  {/* Mode indicator */}
                  {currentMode !== 'normal' && (
                    <div className={cn(
                      "p-3 rounded-lg border flex items-center gap-2",
                      currentMode === 'vacation' 
                        ? "bg-warning/10 border-warning/30 text-warning"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    )}>
                      {currentMode === 'vacation' ? <Palmtree className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      <span className="text-sm">
                        {currentMode === 'vacation' 
                          ? "Plan relajado: sin metas estrictas, foco en bienestar"
                          : "Plan mínimo: solo 1 prioridad, bloques cortos"}
                      </span>
                    </div>
                  )}
                  
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

              {/* Step 8: Validate Agenda */}
              {currentStep === 8 && plan && (
                <ValidateAgendaStep 
                  plan={plan} 
                  calendarEvents={calendarEvents.map(e => {
                    // Helper to calculate end time
                    const calculateEndTime = (startTime: string, duration: string): string => {
                      const [hours, minutes] = startTime.split(':').map(Number);
                      if (isNaN(hours) || isNaN(minutes)) return startTime;
                      let durationMinutes = 0;
                      const hourMatch = duration.match(/(\d+)\s*h/i);
                      const minMatch = duration.match(/(\d+)\s*(?:min|m(?!in)|$)/i);
                      if (hourMatch) durationMinutes += parseInt(hourMatch[1]) * 60;
                      if (minMatch) durationMinutes += parseInt(minMatch[1]);
                      if (!hourMatch && !minMatch) {
                        const plainNum = parseInt(duration);
                        if (!isNaN(plainNum)) durationMinutes = plainNum;
                      }
                      if (durationMinutes === 0) return startTime;
                      const totalMinutes = hours * 60 + minutes + durationMinutes;
                      const endHours = Math.floor(totalMinutes / 60) % 24;
                      const endMinutes = totalMinutes % 60;
                      return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
                    };
                    
                    return {
                      title: e.title,
                      time: e.time,
                      duration: e.duration,
                      endTime: calculateEndTime(e.time, e.duration),
                    };
                  })}
                  onBack={prevStep}
                  onComplete={handleAgendaComplete}
                />
              )}

            </CardContent>
          </Card>

          {/* Navigation Buttons - hide on step 8 */}
          {currentStep !== 8 && (
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

              {currentStep < 7 ? (
                <Button 
                  onClick={nextStep} 
                  className="gap-2"
                  disabled={(currentStep === 3 && checkInSaving) || (currentStep === 5 && boscoGenerating)}
                >
                  {checkInSaving || boscoGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentStepFilled() ? (
                    <>
                      Modificar
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={finishSetup} 
                  className="gap-2"
                  disabled={planLoading || !plan}
                >
                  <Sparkles className="w-4 h-4" />
                  Validar agenda
                </Button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Recipe Dialog */}
      <RecipeDialog
        meal={selectedMealForRecipe}
        preferences={nutritionPrefs}
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
      />
    </div>
  );
};

export default StartDay;
