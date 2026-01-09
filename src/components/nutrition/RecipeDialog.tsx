import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChefHat, 
  Clock, 
  Users, 
  Flame, 
  Loader2,
  CheckCircle2,
  Lightbulb,
  Utensils,
  RefreshCw,
  Heart,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRecipeCache } from "@/hooks/useRecipeCache";
import { useMealHistory } from "@/hooks/useMealHistory";

interface MealOption {
  name: string;
  description: string;
  calories: number;
  prep_time: string;
}

interface Ingredient {
  name: string;
  quantity: string;
  notes?: string;
}

interface Step {
  step_number: number;
  instruction: string;
  time?: string;
  tip?: string;
  speed?: string;
  temperature?: string;
}

interface Recipe {
  recipe_name: string;
  servings: number;
  prep_time?: string;
  cook_time?: string;
  calories_per_serving?: number;
  difficulty?: string;
  ingredients: Ingredient[];
  traditional_steps: Step[];
  thermomix_steps: Step[];
  nutrition_info?: {
    proteins?: string;
    carbs?: string;
    fats?: string;
    fiber?: string;
  };
  tips?: string[];
}

interface RecipeDialogProps {
  meal: MealOption | null;
  mealType?: 'lunch' | 'dinner';
  preferences: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecipeDialog({ meal, mealType = 'lunch', preferences, open, onOpenChange }: RecipeDialogProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipeMode, setRecipeMode] = useState<'traditional' | 'thermomix'>('thermomix');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { getCachedRecipe, cacheRecipe } = useRecipeCache();
  const { addMealToHistory } = useMealHistory();

  const loadRecipe = async () => {
    if (!meal) return;
    
    // Check cache first
    const cached = getCachedRecipe(meal.name);
    if (cached) {
      setRecipe(cached);
      return;
    }
    
    setLoading(true);
    setErrorMessage(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('nutrition-recipe', {
        body: { meal, preferences: preferences || {} }
      });

      if (error) throw error;
      
      if (!data) {
        throw new Error('No se recibió respuesta del servidor');
      }
      
      setRecipe(data);
      // Cache the recipe
      cacheRecipe(meal.name, data);
    } catch (error: any) {
      console.error('Error loading recipe:', error);
      const message = error.message?.includes('429') 
        ? 'Límite de peticiones excedido, intenta en unos minutos'
        : error.message?.includes('402')
        ? 'Créditos de IA agotados'
        : 'Error al cargar la receta';
      
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!meal || !recipe) return;
    
    setSaving(true);
    try {
      await addMealToHistory(mealType, meal.name, recipe);
      setSaved(true);
      toast.success('Receta guardada en favoritos');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  // useEffect to handle race condition - loads when dialog opens AND meal is available
  useEffect(() => {
    if (open && meal && !recipe && !loading) {
      loadRecipe();
    }
  }, [open, meal]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setRecipe(null);
      setErrorMessage(null);
      setSaved(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            {meal?.name || 'Receta'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generando receta detallada...</p>
          </div>
        ) : recipe ? (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-4">
              {/* Quick Info */}
              <div className="flex flex-wrap gap-3">
                {recipe.servings && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    {recipe.servings} raciones
                  </Badge>
                )}
                {recipe.prep_time && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    Prep: {recipe.prep_time}
                  </Badge>
                )}
                {recipe.cook_time && (
                  <Badge variant="outline" className="gap-1">
                    <Utensils className="w-3 h-3" />
                    Cocción: {recipe.cook_time}
                  </Badge>
                )}
                {recipe.calories_per_serving && (
                  <Badge variant="outline" className="gap-1">
                    <Flame className="w-3 h-3" />
                    {recipe.calories_per_serving} kcal/ración
                  </Badge>
                )}
                {recipe.difficulty && (
                  <Badge 
                    variant={recipe.difficulty === 'fácil' ? 'default' : recipe.difficulty === 'media' ? 'secondary' : 'destructive'}
                  >
                    {recipe.difficulty}
                  </Badge>
                )}
              </div>

              {/* Nutrition Info */}
              {recipe.nutrition_info && (
                <div className="grid grid-cols-4 gap-2">
                  {recipe.nutrition_info.proteins && (
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Proteínas</p>
                      <p className="font-semibold">{recipe.nutrition_info.proteins}</p>
                    </div>
                  )}
                  {recipe.nutrition_info.carbs && (
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Carbos</p>
                      <p className="font-semibold">{recipe.nutrition_info.carbs}</p>
                    </div>
                  )}
                  {recipe.nutrition_info.fats && (
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Grasas</p>
                      <p className="font-semibold">{recipe.nutrition_info.fats}</p>
                    </div>
                  )}
                  {recipe.nutrition_info.fiber && (
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Fibra</p>
                      <p className="font-semibold">{recipe.nutrition_info.fiber}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Ingredients */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  🛒 Ingredientes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{ing.quantity}</span>{' '}
                        <span>{ing.name}</span>
                        {ing.notes && (
                          <span className="text-muted-foreground text-sm"> ({ing.notes})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps - Tabbed */}
              <Tabs value={recipeMode} onValueChange={(v) => setRecipeMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="thermomix" className="gap-2">
                    🤖 Thermomix
                  </TabsTrigger>
                  <TabsTrigger value="traditional" className="gap-2">
                    👨‍🍳 Tradicional
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="thermomix" className="mt-4">
                  <div className="space-y-3">
                    {recipe.thermomix_steps.map((step, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                            {step.step_number}
                          </div>
                          <div className="flex-1">
                            <p>{step.instruction}</p>
                            {(step.speed || step.temperature || step.time) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {step.speed && (
                                  <Badge variant="secondary">Vel: {step.speed}</Badge>
                                )}
                                {step.temperature && (
                                  <Badge variant="secondary">🌡️ {step.temperature}</Badge>
                                )}
                                {step.time && (
                                  <Badge variant="secondary">⏱️ {step.time}</Badge>
                                )}
                              </div>
                            )}
                            {step.tip && (
                              <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1">
                                <Lightbulb className="w-4 h-4 shrink-0" />
                                {step.tip}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="traditional" className="mt-4">
                  <div className="space-y-3">
                    {recipe.traditional_steps.map((step, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                            {step.step_number}
                          </div>
                          <div className="flex-1">
                            <p>{step.instruction}</p>
                            {step.time && (
                              <Badge variant="outline" className="mt-2">⏱️ {step.time}</Badge>
                            )}
                            {step.tip && (
                              <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1">
                                <Lightbulb className="w-4 h-4 shrink-0" />
                                {step.tip}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Tips */}
              {recipe.tips && recipe.tips.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-warning" />
                    Consejos del chef
                  </h3>
                  <ul className="space-y-1">
                    {recipe.tips.map((tip, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Save to Favorites */}
              <div className="pt-4 border-t">
                <Button
                  onClick={handleSaveToHistory}
                  disabled={saving || saved}
                  className="w-full gap-2"
                  variant={saved ? "secondary" : "default"}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Heart className="w-4 h-4" />
                  )}
                  {saved ? 'Guardada en favoritos' : 'Guardar en favoritos'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>{errorMessage || 'No se pudo cargar la receta'}</p>
            <Button 
              variant="outline" 
              onClick={loadRecipe} 
              className="mt-4 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
