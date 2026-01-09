import { AlertTriangle, Clock, TrendingUp, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CollapsibleCard } from "./CollapsibleCard";

interface AlertsCardProps {
  pendingCount: number;
}

export const AlertsCard = ({ pendingCount }: AlertsCardProps) => {
  const navigate = useNavigate();

  const alerts = [];

  if (pendingCount > 5) {
    alerts.push({
      id: "overload",
      type: "overload" as const,
      message: `Tienes ${pendingCount} tareas pendientes`,
      action: "Revisar tareas",
      onClick: () => navigate("/tasks"),
    });
  }

  if (pendingCount === 0) {
    alerts.push({
      id: "clear",
      type: "info" as const,
      message: "Sin tareas pendientes. ¡Buen trabajo!",
      action: undefined,
      onClick: undefined,
    });
  }

  const alertConfig = {
    warning: {
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10 border-warning/20",
    },
    info: {
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10 border-success/20",
    },
    overload: {
      icon: TrendingUp,
      color: "text-destructive",
      bgColor: "bg-destructive/10 border-destructive/20",
    },
  };

  const badge = alerts.length > 0 && pendingCount > 5 ? (
    <span className="ml-2 w-5 h-5 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center font-medium font-mono">
      !
    </span>
  ) : undefined;

  return (
    <CollapsibleCard
      id="alerts"
      title="Estado del Sistema"
      icon={<AlertTriangle className="w-4 h-4 text-warning" />}
      badge={badge}
    >
      <div className="p-3 sm:p-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-primary/10 border-primary/20">
            <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">Sistema operativo correctamente</p>
              <p className="text-xs text-muted-foreground mt-1">{pendingCount} tareas activas</p>
            </div>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = alertConfig[alert.type];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor}`}
              >
                <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{alert.message}</p>
                  {alert.action && (
                    <button 
                      onClick={alert.onClick}
                      className={`mt-2 text-xs font-medium ${config.color} hover:underline font-mono`}
                    >
                      {alert.action} →
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </CollapsibleCard>
  );
};
