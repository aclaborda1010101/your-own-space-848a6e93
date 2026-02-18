import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Calendar,
  Bell,
  BellOff,
  Clock,
  MapPin,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Settings,
  Loader2,
  Tv
} from "lucide-react";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  date: string;
  time: string;
  venue?: string;
  isLive?: boolean;
  score?: { home: number; away: number };
}

interface Alert {
  id: string;
  type: "injury" | "transfer" | "news" | "lineup";
  title: string;
  description: string;
  team: string;
  time: string;
  priority: "high" | "normal";
}

// Mock data - will be replaced with real API
const mockMatches: Match[] = [
  {
    id: "1",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    competition: "LaLiga",
    date: "2026-02-08",
    time: "21:00",
    venue: "Santiago Bernabéu",
  },
  {
    id: "2",
    homeTeam: "Atlético Madrid",
    awayTeam: "Real Madrid",
    competition: "LaLiga",
    date: "2026-02-15",
    time: "18:30",
    venue: "Metropolitano",
  },
  {
    id: "3",
    homeTeam: "Real Madrid",
    awayTeam: "Manchester City",
    competition: "Champions League",
    date: "2026-02-25",
    time: "21:00",
    venue: "Santiago Bernabéu",
  },
];

const mockAlerts: Alert[] = [
  {
    id: "1",
    type: "injury",
    title: "Lesión de Vinícius Jr.",
    description: "El brasileño se ha lesionado en el entrenamiento y será baja 2-3 semanas.",
    team: "Real Madrid",
    time: "Hace 2h",
    priority: "high",
  },
  {
    id: "2",
    type: "lineup",
    title: "Alineación confirmada",
    description: "Ancelotti ha confirmado el once para el Clásico.",
    team: "Real Madrid",
    time: "Hace 5h",
    priority: "normal",
  },
];

const Sports = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const getCompetitionColor = (competition: string) => {
    switch (competition) {
      case "LaLiga":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "Champions League":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      default:
        return "bg-primary/10 text-primary border-primary/30";
    }
  };

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "injury":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "transfer":
        return <TrendingUp className="w-4 h-4 text-success" />;
      case "lineup":
        return <Trophy className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center shadow-lg shadow-warning/30">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Deportes</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  ALERTAS LALIGA & CHAMPIONS
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-primary" />
                ) : (
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                )}
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {mockAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Alertas Recientes
              </h2>
              {mockAlerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={cn(
                    "border-border bg-card transition-all",
                    alert.priority === "high" && "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        alert.priority === "high" ? "bg-destructive/10" : "bg-muted"
                      )}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                          <Badge variant="outline" className="text-xs">{alert.team}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{alert.description}</p>
                        <span className="text-xs text-muted-foreground">{alert.time}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Upcoming Matches */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Próximos Partidos
            </h2>
            {mockMatches.map((match) => (
              <Card key={match.id} className="border-border bg-card hover:border-primary/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Badge variant="outline" className={cn("text-xs mb-2", getCompetitionColor(match.competition))}>
                        {match.competition}
                      </Badge>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{match.homeTeam}</span>
                        <span className="text-muted-foreground text-sm">vs</span>
                        <span className="font-semibold text-foreground">{match.awayTeam}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(match.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {match.time}
                        </span>
                        {match.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {match.venue}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Tv className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Team Selection Card */}
          <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Configura tus equipos favoritos</p>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Añadir equipos
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Sports;
