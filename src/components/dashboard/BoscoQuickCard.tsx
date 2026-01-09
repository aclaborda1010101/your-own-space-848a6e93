import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBosco, BoscoActivity } from "@/hooks/useBosco";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { 
  Baby, 
  RefreshCw, 
  Check, 
  ChevronRight,
  Gamepad2,
  BookOpen,
  Globe,
  Sparkles,
  Move,
  Moon
} from "lucide-react";

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  juego_vinculo: { label: "Juego", icon: Gamepad2, color: "text-pink-500" },
  lectura: { label: "Lectura", icon: BookOpen, color: "text-blue-500" },
  ingles_ludico: { label: "Inglés", icon: Globe, color: "text-green-500" },
  ia_ninos: { label: "IA", icon: Sparkles, color: "text-purple-500" },
  movimiento: { label: "Movimiento", icon: Move, color: "text-orange-500" },
  cierre_dia: { label: "Cierre", icon: Moon, color: "text-indigo-500" },
};

interface BoscoQuickCardProps {
  compact?: boolean;
}

export function BoscoQuickCard({ compact = false }: BoscoQuickCardProps) {
  const { 
    activities, 
    loading, 
    generatingActivities, 
    generateActivities, 
    completeActivity 
  } = useBosco();

  const pendingActivities = activities.filter(a => !a.completed);
  const completedCount = activities.filter(a => a.completed).length;

  if (compact) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-pink-500" />
            <span className="font-medium">Bosco</span>
          </div>
          <Badge variant="secondary">{pendingActivities.length} pendientes</Badge>
        </div>
        
        {pendingActivities.length === 0 ? (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => generateActivities('all')}
            disabled={generatingActivities}
          >
            <RefreshCw className={cn("w-4 h-4", generatingActivities && "animate-spin")} />
            Generar actividades
          </Button>
        ) : (
          <div className="space-y-2">
            {pendingActivities.slice(0, 2).map(activity => {
              const config = ACTIVITY_TYPE_CONFIG[activity.activity_type] || ACTIVITY_TYPE_CONFIG.juego_vinculo;
              const Icon = config.icon;
              return (
                <div 
                  key={activity.id} 
                  className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                >
                  <Icon className={cn("w-4 h-4", config.color)} />
                  <span className="flex-1 truncate">{activity.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => completeActivity(activity.id)}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        
        <Link to="/bosco">
          <Button variant="ghost" size="sm" className="w-full gap-2">
            Ver todas
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 min-w-0">
            <Baby className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500 flex-shrink-0" />
            <span className="truncate">Actividades con Bosco</span>
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {completedCount > 0 && (
              <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                {completedCount} ✓
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => generateActivities('all')}
              disabled={generatingActivities}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", generatingActivities && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
        {loading ? (
          <div className="text-center py-3 sm:py-4 text-muted-foreground text-sm">
            Cargando...
          </div>
        ) : pendingActivities.length === 0 ? (
          <div className="text-center py-3 sm:py-4">
            <p className="text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3">No hay actividades para hoy</p>
            <Button 
              size="sm" 
              onClick={() => generateActivities('all')}
              disabled={generatingActivities}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Generar actividades
            </Button>
          </div>
        ) : (
          <>
            {pendingActivities.slice(0, 3).map(activity => {
              const config = ACTIVITY_TYPE_CONFIG[activity.activity_type] || ACTIVITY_TYPE_CONFIG.juego_vinculo;
              const Icon = config.icon;
              return (
                <div 
                  key={activity.id} 
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-muted flex-shrink-0")}>
                    <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{activity.title}</p>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-2">{config.label}</Badge>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{activity.duration_minutes} min</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 sm:h-8 sm:w-8 text-success hover:text-success flex-shrink-0"
                    onClick={() => completeActivity(activity.id)}
                  >
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              );
            })}
            
            {pendingActivities.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{pendingActivities.length - 3} más
              </p>
            )}
          </>
        )}
        
        <Link to="/bosco" className="block">
          <Button variant="outline" size="sm" className="w-full gap-2 text-xs sm:text-sm h-8 sm:h-9">
            <Baby className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Ir a Bosco
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
