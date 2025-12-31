import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartNotification } from "@/hooks/useSmartNotifications";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  AlertCircle, 
  Coffee, 
  Heart, 
  Zap, 
  Sparkles,
  X,
  ArrowRight,
  Bell
} from "lucide-react";

interface NotificationsPanelProps {
  notifications: SmartNotification[];
  onDismiss: (notification: SmartNotification) => void;
  loading?: boolean;
}

const typeConfig = {
  overload: {
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10 border-destructive/20",
  },
  p0_urgent: {
    icon: AlertCircle,
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/20",
  },
  rest: {
    icon: Coffee,
    color: "text-success",
    bgColor: "bg-success/10 border-success/20",
  },
  health: {
    icon: Heart,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10 border-chart-4/20",
  },
  focus: {
    icon: Zap,
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/20",
  },
  motivation: {
    icon: Sparkles,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10 border-chart-5/20",
  },
};

export const NotificationsPanel = ({ notifications, onDismiss, loading }: NotificationsPanelProps) => {
  const navigate = useNavigate();

  const handleAction = (notification: SmartNotification) => {
    switch (notification.actionType) {
      case "navigate_tasks":
        navigate("/tasks");
        break;
      case "navigate_calendar":
        navigate("/calendar");
        break;
      case "start_break":
        // Could open a break timer modal
        onDismiss(notification);
        break;
      case "dismiss":
      default:
        onDismiss(notification);
    }
  };

  if (notifications.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Alertas inteligentes</span>
            {notifications.length > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-pulse flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Analizando tu día...</p>
            </div>
          ) : (
            notifications.map((notification, index) => {
              const config = typeConfig[notification.type] || typeConfig.motivation;
              const Icon = config.icon;

              return (
                <div
                  key={`${notification.type}-${index}`}
                  className={`p-4 ${config.bgColor} border-l-4 transition-all hover:bg-opacity-20`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                    
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${config.color}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      
                      {notification.actionLabel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(notification)}
                          className={`mt-2 h-7 px-2 text-xs ${config.color} hover:bg-background/50`}
                        >
                          {notification.actionLabel}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDismiss(notification)}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
