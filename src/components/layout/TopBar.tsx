import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, Bell, BellOff, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
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
    <header className="h-14 md:h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30 pt-[env(safe-area-inset-top)]" style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}>
      <div className="h-full flex items-center justify-between px-3 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Hide greeting and date on mobile */}
          <div className="hidden md:block">
            <p className="text-sm text-muted-foreground">{greeting}</p>
            <h2 className="text-lg font-semibold text-foreground">
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Search className="w-5 h-5" />
          </Button>
          
          {/* Notification indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative text-muted-foreground hover:text-foreground"
                onClick={handleRequestNotifications}
              >
                {notificationPermission === "granted" ? (
                  <>
                    <Bell className="w-5 h-5 text-success" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full" />
                  </>
                ) : notificationPermission === "denied" ? (
                  <BellOff className="w-5 h-5 text-destructive" />
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full animate-pulse" />
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
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link to="/settings">
                  <Settings className="w-5 h-5" />
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
