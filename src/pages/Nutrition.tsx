import { useState, useEffect } from "react";
import { useNutrition } from "@/hooks/useNutrition";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Utensils,
  Send,
  Loader2,
  Plus,
  X,
  Apple,
  Target,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Trash2,
  ChefHat,
  Coffee,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { RecipeDialog } from "@/components/nutrition/RecipeDialog";
import { LearnedPreferencesCard } from "@/components/nutrition/LearnedPreferencesCard";
import { ShoppingListCard } from "@/components/nutrition/ShoppingListCard";
import { MealHistoryCard } from "@/components/nutrition/MealHistoryCard";
import { SupplementsCard } from "@/components/nutrition/SupplementsCard";
import { NutritionContextCard } from "@/components/nutrition/NutritionContextCard";

const DIET_TYPES = [
  { value: 'balanced', label: 'Balanceada' },
  { value: 'mediterranean', label: 'Mediterránea' },
  { value: 'vegetarian', label: 'Vegetariana' },
  { value: 'vegan', label: 'Vegana' },
  { value: 'keto', label: 'Cetogénica' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'low-carb', label: 'Baja en carbohidratos' },
];

const GOALS = [
  { value: 'lose', label: 'Perder peso' },
  { value: 'maintain', label: 'Mantener peso' },
  { value: 'gain', label: 'Ganar masa muscular' },
  { value: 'health', label: 'Mejorar salud' },
];

interface MealOption {
  name: string;
  description: string;
  calories: number;
  prep_time: string;
}

interface MealEntry {
  type: "breakfast" | "lunch" | "dinner";
  name: string;
  calories?: number;
  time: string;
}

const MEAL_SLOTS = [
  { type: "breakfast" as const, label: "Desayuno", icon: Coffee, timeRange: "7:00 - 10:00" },
  { type: "lunch" as const, label: "Almuerzo", icon: Sun, timeRange: "12:00 - 15:00" },
  { type: "dinner" as const, label: "Cena", icon: Moon, timeRange: "19:00 - 22:00" },
];

const Nutrition = () => {

  const { preferences, loading, saving, savePreferences, chatMessages, chatLoading, sendChatMessage, clearChat } = useNutrition();

  const [chatInput, setChatInput] = useState('');
  const [newRestriction, setNewRestriction] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealOption | null>(null);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);

  // Daily meal log state
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<"breakfast" | "lunch" | "dinner">("breakfast");
  const [quickLogName, setQuickLogName] = useState("");
  const [quickLogCalories, setQuickLogCalories] = useState("");
  const [showNudge, setShowNudge] = useState(false);

  // Check if accountability nudge should show
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 14 && todayMeals.length === 0) {
      setShowNudge(true);
    } else {
      setShowNudge(false);
    }
  }, [todayMeals]);

  const getMealForType = (type: string) => todayMeals.find(m => m.type === type);

  const handleQuickLog = (type: "breakfast" | "lunch" | "dinner") => {
    setQuickLogType(type);
    setQuickLogName("");
    setQuickLogCalories("");
    setQuickLogOpen(true);
  };

  const submitQuickLog = () => {
    if (!quickLogName.trim()) return;
    const entry: MealEntry = {
      type: quickLogType,
      name: quickLogName.trim(),
      calories: quickLogCalories ? parseInt(quickLogCalories) : undefined,
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    };
    setTodayMeals(prev => [...prev.filter(m => m.type !== quickLogType), entry]);
    setQuickLogOpen(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const message = chatInput;
    setChatInput('');
    await sendChatMessage(message);
  };

  const addRestriction = () => {
    if (!newRestriction.trim() || !preferences) return;
    savePreferences({
      restrictions: [...(preferences.restrictions || []), newRestriction.trim()],
    });
    setNewRestriction('');
  };

  const removeRestriction = (index: number) => {
    if (!preferences) return;
    const newRestrictions = [...preferences.restrictions];
    newRestrictions.splice(index, 1);
    savePreferences({ restrictions: newRestrictions });
  };

  const addAllergy = () => {
    if (!newAllergy.trim() || !preferences) return;
    savePreferences({
      allergies: [...(preferences.allergies || []), newAllergy.trim()],
    });
    setNewAllergy('');
  };

  const removeAllergy = (index: number) => {
    if (!preferences) return;
    const newAllergies = [...preferences.allergies];
    newAllergies.splice(index, 1);
    savePreferences({ allergies: newAllergies });
  };

  const handleMealClick = (meal: MealOption) => {
    setSelectedMeal(meal);
    setRecipeDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
        <main className="p-4 lg:p-6 space-y-6">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Utensils className="w-6 h-6 text-success" />
                Jarvis Nutrición
              </h1>
              <p className="text-muted-foreground">Configura tu dieta y chatea con tu asistente nutricional</p>
            </div>

            {/* Accountability Nudge */}
            {showNudge && (
              <Card className="mb-6 border-warning/30 bg-warning/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">No has registrado comidas hoy</p>
                      <p className="text-sm text-muted-foreground">
                        Son las {new Date().getHours()}:00 y aún no hay registros. Registra lo que has comido para mantener el seguimiento.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleQuickLog("lunch")}>
                      Registrar ahora
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Daily Meals Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-success" />
                  Comidas de hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {MEAL_SLOTS.map(slot => {
                    const meal = getMealForType(slot.type);
                    const Icon = slot.icon;
                    return (
                      <div
                        key={slot.type}
                        className={cn(
                          "p-4 rounded-lg border text-center transition-all cursor-pointer hover:bg-muted/50",
                          meal ? "border-success/30 bg-success/5" : "border-dashed"
                        )}
                        onClick={() => !meal && handleQuickLog(slot.type)}
                      >
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Icon className={cn("w-5 h-5", meal ? "text-success" : "text-muted-foreground")} />
                          {meal && <CheckCircle2 className="w-4 h-4 text-success" />}
                        </div>
                        <p className="font-medium text-sm">{slot.label}</p>
                        {meal ? (
                          <>
                            <p className="text-xs text-muted-foreground mt-1">{meal.name}</p>
                            {meal.calories && (
                              <Badge variant="secondary" className="mt-1 text-xs">{meal.calories} kcal</Badge>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">{slot.timeRange}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {todayMeals.length}/3 comidas registradas
                    {todayMeals.length > 0 && todayMeals.some(m => m.calories) && (
                      <> · ~{todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0)} kcal total</>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Análisis nutricional contextual LLM (cruzado con Whoop + tareas) */}
            <div className="mb-6">
              <NutritionContextCard />
            </div>

            {/* Content - 3 column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Configuration */}
              <div className="lg:col-span-2 space-y-6">
                {/* Diet Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Apple className="w-5 h-5 text-success" />
                      Tipo de Dieta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {DIET_TYPES.map((diet) => (
                        <Button
                          key={diet.value}
                          variant={preferences?.diet_type === diet.value ? 'default' : 'outline'}
                          className="w-full"
                          onClick={() => savePreferences({ diet_type: diet.value })}
                          disabled={saving}
                        >
                          {diet.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Objetivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {GOALS.map((goal) => (
                        <Button
                          key={goal.value}
                          variant={preferences?.goals === goal.value ? 'default' : 'outline'}
                          className="w-full"
                          onClick={() => savePreferences({ goals: goal.value })}
                          disabled={saving}
                        >
                          {goal.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Macros */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-warning" />
                      Objetivos Nutricionales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-warning" />
                          <span>Calorías</span>
                        </div>
                        <span className="font-mono font-bold">{preferences?.calories_target} kcal</span>
                      </div>
                      <Slider
                        value={[preferences?.calories_target || 2000]}
                        onValueChange={([value]) => savePreferences({ calories_target: value })}
                        min={1200}
                        max={4000}
                        step={50}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Beef className="w-4 h-4 text-destructive" />
                          <span className="text-sm">Proteínas</span>
                        </div>
                        <Input
                          type="number"
                          value={preferences?.proteins_target || 100}
                          onChange={(e) => savePreferences({ proteins_target: Number(e.target.value) })}
                          className="font-mono"
                        />
                        <span className="text-xs text-muted-foreground">gramos</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Wheat className="w-4 h-4 text-warning" />
                          <span className="text-sm">Carbos</span>
                        </div>
                        <Input
                          type="number"
                          value={preferences?.carbs_target || 250}
                          onChange={(e) => savePreferences({ carbs_target: Number(e.target.value) })}
                          className="font-mono"
                        />
                        <span className="text-xs text-muted-foreground">gramos</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-primary" />
                          <span className="text-sm">Grasas</span>
                        </div>
                        <Input
                          type="number"
                          value={preferences?.fats_target || 70}
                          onChange={(e) => savePreferences({ fats_target: Number(e.target.value) })}
                          className="font-mono"
                        />
                        <span className="text-xs text-muted-foreground">gramos</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Restrictions & Allergies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Restricciones alimentarias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Añadir restricción..."
                          value={newRestriction}
                          onChange={(e) => setNewRestriction(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addRestriction()}
                        />
                        <Button size="icon" onClick={addRestriction}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {preferences?.restrictions?.map((r, i) => (
                          <Badge key={i} variant="secondary" className="gap-1">
                            {r}
                            <button onClick={() => removeRestriction(i)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Alergias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Añadir alergia..."
                          value={newAllergy}
                          onChange={(e) => setNewAllergy(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
                        />
                        <Button size="icon" onClick={addAllergy}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {preferences?.allergies?.map((a, i) => (
                          <Badge key={i} variant="destructive" className="gap-1">
                            {a}
                            <button onClick={() => removeAllergy(i)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notas adicionales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Añade cualquier nota adicional sobre tus preferencias alimentarias..."
                      value={preferences?.preferences_notes || ''}
                      onChange={(e) => savePreferences({ preferences_notes: e.target.value })}
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - New Cards */}
              <div className="space-y-6">
                {/* Supplements */}
                <SupplementsCard />

                {/* Shopping List */}
                <ShoppingListCard />

                {/* Meal History */}
                <MealHistoryCard />

                {/* Learned Preferences Card */}
                <LearnedPreferencesCard chatMessages={chatMessages} />

                {/* Chat Panel */}
                <Card className="h-[400px] flex flex-col">
                  <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-primary" />
                      Chat con Jarvis
                    </CardTitle>
                    {chatMessages.length > 0 && (
                      <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                    <ScrollArea className="flex-1 px-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6">
                          <Utensils className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Cuéntame tus gustos y preferencias.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pb-4">
                          {chatMessages.map((msg, i) => (
                            <div
                              key={i}
                              className={cn(
                                "p-3 rounded-lg max-w-[90%]",
                                msg.role === 'user'
                                  ? "bg-primary text-primary-foreground ml-auto"
                                  : "bg-muted"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Escribiendo...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ej: No me gusta el pescado..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          disabled={chatLoading}
                          className="text-sm"
                        />
                        <Button size="icon" onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>


      {/* Quick Log Dialog */}
      <Dialog open={quickLogOpen} onOpenChange={setQuickLogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Registrar {quickLogType === "breakfast" ? "Desayuno" : quickLogType === "lunch" ? "Almuerzo" : "Cena"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">¿Qué comiste?</label>
              <Input
                value={quickLogName}
                onChange={(e) => setQuickLogName(e.target.value)}
                placeholder="Ej: Ensalada de pollo con arroz"
                onKeyDown={(e) => e.key === "Enter" && submitQuickLog()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Calorías estimadas (opcional)</label>
              <Input
                type="number"
                value={quickLogCalories}
                onChange={(e) => setQuickLogCalories(e.target.value)}
                placeholder="Ej: 450"
              />
            </div>
            <Button onClick={submitQuickLog} disabled={!quickLogName.trim()} className="w-full">
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Dialog */}
      <RecipeDialog
        meal={selectedMeal}
        preferences={preferences}
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
      />
    </>
  );
};

export default Nutrition;
