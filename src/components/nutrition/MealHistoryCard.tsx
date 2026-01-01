import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Loader2,
  TrendingUp,
  Check,
  Clock
} from "lucide-react";
import { useMealHistory } from "@/hooks/useMealHistory";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
};

export const MealHistoryCard = () => {
  const { history, loading, getMealFrequency, getRecentMeals } = useMealHistory();
  
  const recentMeals = getRecentMeals(7);
  const topMeals = getMealFrequency().slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Historial de Comidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Meals */}
        {topMeals.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Tus platos favoritos
            </h4>
            <div className="flex flex-wrap gap-2">
              {topMeals.map(([name, count]) => (
                <Badge key={name} variant="secondary" className="font-normal">
                  {name} <span className="ml-1 opacity-70">×{count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent Meals */}
        {recentMeals.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay comidas registradas</p>
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-medium mb-2">Últimos 7 días</h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {recentMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{meal.meal_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(meal.date), 'EEE d', { locale: es })}</span>
                        <Badge variant="outline" className="text-xs py-0">
                          {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                        </Badge>
                      </div>
                    </div>
                    {meal.was_completed ? (
                      <Check className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    {meal.energy_after && (
                      <Badge variant="secondary" className="text-xs">
                        ⚡ {meal.energy_after}/5
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
