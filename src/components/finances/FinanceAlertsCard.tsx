import { useFinanceAlerts, FinanceAlert } from "@/hooks/useFinanceAlerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Calendar, Target, X, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function FinanceAlertsCard() {
  const { alerts, loading, checkAlerts, dismissAlert } = useFinanceAlerts();

  const getAlertIcon = (type: FinanceAlert["type"]) => {
    switch (type) {
      case "invoice_overdue":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "invoice_due":
        return <Calendar className="h-4 w-4 text-warning" />;
      case "goal_deadline":
      case "goal_progress":
        return <Target className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: FinanceAlert["priority"]) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (alerts.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas ({alerts.length})
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={checkAlerts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-background border"
          >
            <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{alert.title}</span>
                <Badge variant={getPriorityColor(alert.priority)} className="text-xs">
                  {alert.priority === "high" ? "Urgente" : alert.priority === "medium" ? "Medio" : "Bajo"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              {alert.dueDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fecha: {format(parseISO(alert.dueDate), "d MMM yyyy", { locale: es })}
                  {alert.amount && ` · ${alert.amount.toLocaleString("es-ES")}€`}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => dismissAlert(alert.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
