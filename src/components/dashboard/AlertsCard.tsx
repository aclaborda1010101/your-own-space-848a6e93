import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, TrendingUp, Calendar } from "lucide-react";

interface Alert {
  id: string;
  type: "warning" | "info" | "overload";
  message: string;
  action?: string;
}

const mockAlerts: Alert[] = [
  { 
    id: "1", 
    type: "overload", 
    message: "Agenda al 90% de capacidad",
    action: "Recortar bloque"
  },
  { 
    id: "2", 
    type: "warning", 
    message: "Tarea P0 pendiente desde hace 2 días",
    action: "Ver tarea"
  },
  { 
    id: "3", 
    type: "info", 
    message: "Hueco de 45 min disponible a las 16:00",
    action: "Bloquear"
  },
];

const alertConfig = {
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/20",
  },
  info: {
    icon: Clock,
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/20",
  },
  overload: {
    icon: TrendingUp,
    color: "text-destructive",
    bgColor: "bg-destructive/10 border-destructive/20",
  },
};

export const AlertsCard = () => {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          Alertas
          {mockAlerts.length > 0 && (
            <span className="ml-auto w-5 h-5 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center font-medium">
              {mockAlerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockAlerts.map((alert) => {
            const config = alertConfig[alert.type];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{alert.message}</p>
                  {alert.action && (
                    <button className={`mt-2 text-xs font-medium ${config.color} hover:underline`}>
                      {alert.action} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
