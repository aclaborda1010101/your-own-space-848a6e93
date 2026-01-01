import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pill, Clock, Loader2 } from "lucide-react";
import { useNutritionProfile } from "@/hooks/useNutritionProfile";
import { cn } from "@/lib/utils";

const MOMENT_LABELS: Record<string, string> = {
  'post_entreno': 'Post entreno',
  'comida_principal': 'Comida principal',
  'noche': 'Noche',
  'mañana': 'Mañana',
};

export const SupplementsCard = () => {
  const { profile, supplementLogs, loading, logSupplement, removeSupplementLog } = useNutritionProfile();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const supplements = profile?.supplements || [];

  const isSupplementTaken = (name: string) => {
    return supplementLogs.some((log) => log.supplement_name === name);
  };

  const getLogForSupplement = (name: string) => {
    return supplementLogs.find((log) => log.supplement_name === name);
  };

  const handleToggle = (supplementName: string) => {
    const log = getLogForSupplement(supplementName);
    if (log) {
      removeSupplementLog(log.id);
    } else {
      logSupplement(supplementName);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          Suplementos del Día
        </CardTitle>
      </CardHeader>
      <CardContent>
        {supplements.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay suplementos configurados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {supplements.map((supplement, index) => {
              const taken = isSupplementTaken(supplement.name);
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                    taken ? "bg-success/10" : "bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={taken}
                    onCheckedChange={() => handleToggle(supplement.name)}
                  />
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium",
                      taken && "line-through text-muted-foreground"
                    )}>
                      {supplement.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{MOMENT_LABELS[supplement.moment] || supplement.moment}</span>
                      {supplement.dose && (
                        <Badge variant="outline" className="text-xs py-0">
                          {supplement.dose}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
