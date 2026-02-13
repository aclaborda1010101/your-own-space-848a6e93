import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, Bell, BellOff, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModeSelector } from "@/components/dashboard/ModeSelector";

interface TopBarProps {
  onMenuClick: () => void;
  showModeSelector?: boolean;
}

export const TopBar = ({ onMenuClick, showModeSelector = false }: TopBarProps) => {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  return (
    <header className="safe-top glass-card border-b border-border/50 sticky top-0 z-30">
      <div className="h-12 md:h-14 flex items-center justify-between px-3 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden md:block">
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{greeting}</p>
            <h2 className="text-sm font-semibold text-foreground">
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {showModeSelector && <ModeSelector compact />}

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Search className="w-4 h-4" />
          </Button>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-xl relative text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                onClick={handleRequestNotifications}
              >
                {notificationPermission === "granted" ? (
                  <>
                    <Bell className="w-4 h-4 text-success" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-success rounded-full" />
                  </>
                ) : notificationPermission === "denied" ? (
                  <BellOff className="w-4 h-4 text-destructive" />
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {notificationPermission === "granted" 
                ? "Notificaciones habilitadas" 
                : notificationPermission === "denied"
                ? "Notificaciones bloqueadas"
                : "Haz clic para habilitar notificaciones"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                asChild
              >
                <Link to="/settings">
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajustes</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};
