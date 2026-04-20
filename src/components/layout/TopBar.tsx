import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, Bell, BellOff, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    if ("Notification" in window) setNotificationPermission(Notification.permission);
  }, []);

  const handleRequestNotifications = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl overflow-hidden">
      <div className="h-14 md:h-16 flex items-center justify-between px-3 lg:px-6 relative">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:block leading-tight">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {greeting}
            </p>
            <h2 className="font-display text-lg font-semibold text-foreground capitalize">
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {showModeSelector && <ModeSelector compact />}

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
          >
            <Search className="w-5 h-5" />
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={handleRequestNotifications}
              >
                {notificationPermission === "granted" ? (
                  <>
                    <Bell className="w-5 h-5 text-success" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-success rounded-full shadow-[0_0_8px_hsl(var(--success)/0.7)]" />
                  </>
                ) : notificationPermission === "denied" ? (
                  <BellOff className="w-5 h-5 text-destructive" />
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-warning rounded-full animate-pulse" />
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
                className="rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
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
