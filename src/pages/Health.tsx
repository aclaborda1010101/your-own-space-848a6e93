import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity,
  Heart,
  Moon,
  Zap,
  TrendingUp,
  RefreshCw,
  Loader2,
  Settings,
  Link2,
  Clock,
  Battery,
  BrainCircuit
} from "lucide-react";

// WHOOP OAuth2 config (from MEGAPROMPT)
const WHOOP_CLIENT_ID = "80dc3ed7-c5bf-47eb-9c9d-5873cf281c7d";
const WHOOP_SCOPES = "read:recovery read:cycles read:sleep read:workout read:profile";

interface WhoopData {
  recovery: number;
  hrv: number;
  strain: number;
  sleepHours: number;
  restingHR: number;
  lastUpdated: string;
}

// Mock data - will be replaced with real WHOOP integration
const mockWhoopData: WhoopData = {
  recovery: 85,
  hrv: 62,
  strain: 8.4,
  sleepHours: 7.5,
  restingHR: 52,
  lastUpdated: new Date().toISOString(),
};

const Health = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopData | null>(null);

  const handleConnectWhoop = async () => {
    // TODO: Implement OAuth2 flow
    toast.info("Conectando con WHOOP...");
    
    // Simulate connection for now
    setLoading(true);
    setTimeout(() => {
      setIsConnected(true);
      setWhoopData(mockWhoopData);
      setLoading(false);
      toast.success("Conectado a WHOOP");
    }, 2000);
  };

  const handleRefresh = async () => {
    setLoading(true);
    // TODO: Fetch real data
    setTimeout(() => {
      setWhoopData(mockWhoopData);
      setLoading(false);
    }, 1000);
  };

  const getRecoveryColor = (recovery: number) => {
    if (recovery >= 67) return "text-success";
    if (recovery >= 34) return "text-warning";
    return "text-destructive";
  };

  const getRecoveryBgColor = (recovery: number) => {
    if (recovery >= 67) return "bg-success";
    if (recovery >= 34) return "bg-warning";
    return "bg-destructive";
  };

  const getStrainColor = (strain: number) => {
    if (strain >= 14) return "text-destructive";
    if (strain >= 10) return "text-warning";
    return "text-success";
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shadow-lg shadow-success/30">
                <Activity className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Salud</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  MÉTRICAS WHOOP
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {isConnected && (
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Button variant="outline" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!isConnected ? (
            /* Connect WHOOP Card */
            <Card className="border-dashed border-2 border-success/30 bg-success/5">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <Activity className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Conecta tu WHOOP</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Sincroniza tus métricas de salud para optimizar tu planificación diaria basada en tu estado físico real.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <Badge variant="outline" className="gap-1">
                    <Heart className="w-3 h-3" /> Recovery
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <BrainCircuit className="w-3 h-3" /> HRV
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Zap className="w-3 h-3" /> Strain
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Moon className="w-3 h-3" /> Sleep
                  </Badge>
                </div>
                <Button onClick={handleConnectWhoop} disabled={loading} className="gap-2">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Conectar WHOOP
                </Button>
              </CardContent>
            </Card>
          ) : whoopData && (
            /* WHOOP Dashboard */
            <>
              {/* Recovery Score - Main Card */}
              <Card className="border-success/30 bg-gradient-to-br from-success/10 to-transparent overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-mono mb-1">RECOVERY SCORE</p>
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-6xl font-bold", getRecoveryColor(whoopData.recovery))}>
                          {whoopData.recovery}%
                        </span>
                        <Badge className={cn("text-white", getRecoveryBgColor(whoopData.recovery))}>
                          {whoopData.recovery >= 67 ? "VERDE" : whoopData.recovery >= 34 ? "AMARILLO" : "ROJO"}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-24 h-24 rounded-full border-4 border-success/30 flex items-center justify-center">
                      <div className={cn("w-20 h-20 rounded-full flex items-center justify-center", getRecoveryBgColor(whoopData.recovery))}>
                        <Heart className="w-10 h-10 text-white" />
                      </div>
                    </div>
                  </div>
                  <Progress value={whoopData.recovery} className="h-2 mt-4" />
                </CardContent>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* HRV */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BrainCircuit className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-mono">HRV</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{whoopData.hrv}</p>
                    <p className="text-xs text-muted-foreground">ms</p>
                  </CardContent>
                </Card>

                {/* Strain */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className={cn("w-4 h-4", getStrainColor(whoopData.strain))} />
                      <span className="text-xs text-muted-foreground font-mono">STRAIN</span>
                    </div>
                    <p className={cn("text-3xl font-bold", getStrainColor(whoopData.strain))}>
                      {whoopData.strain.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">/ 21.0</p>
                  </CardContent>
                </Card>

                {/* Sleep */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Moon className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-mono">SUEÑO</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{whoopData.sleepHours}</p>
                    <p className="text-xs text-muted-foreground">horas</p>
                  </CardContent>
                </Card>

                {/* Resting HR */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-muted-foreground font-mono">FC REPOSO</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{whoopData.restingHR}</p>
                    <p className="text-xs text-muted-foreground">bpm</p>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Chart Placeholder */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Tendencia Semanal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center border border-dashed border-border rounded-lg">
                    <p className="text-sm text-muted-foreground">Gráfico de evolución semanal</p>
                  </div>
                </CardContent>
              </Card>

              {/* Last Update */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Última actualización: {new Date(whoopData.lastUpdated).toLocaleString("es-ES")}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Health;
